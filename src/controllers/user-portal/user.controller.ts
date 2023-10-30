import { Request, Response } from 'express';
import { NUMBER_REGEX, PHONE_NUMBER_REGEX } from '../../constants';
import { Database } from '../../database';
import {
	DBUserDetails,
	IUserInDB,
	IUserProfileApiResponse,
	MerchantDetails,
	TLongCountryCodes,
	TShortCountryCodes,
} from '../../models';
import { AuthorizationHeaderKeyValues, getSystemISOString, isUserAuthenticated } from '../../util';
import { sendResponse, Status } from '../../util/log-response.util';
import { sendWelcomeEmail } from '../../util/send-email.util';
import { IShippingDetails } from './make-payment-v2.controller';

const getShortFormCountry = (country: TLongCountryCodes) => {
	let shortFormCountry: 'sg' | 'my' = null;
	if (country?.toLowerCase() === 'singapore') {
		shortFormCountry = 'sg';
	} else if (country?.toLowerCase() === 'malaysia') {
		shortFormCountry = 'my';
	}
	return shortFormCountry;
};

const getFullCountryName = (shortCode: TShortCountryCodes): TLongCountryCodes => {
	if (shortCode === 'my') {
		return 'malaysia';
	}
	return 'singapore';
};
export const addNewUserToDB_UP = async ({
	details,
	user,
	userCountry,
	provider,
}: {
	details: DBUserDetails | MerchantDetails;
	user: { uid: string };
	userCountry: TShortCountryCodes;
	provider: 'facebook' | 'google' | 'apple' | 'email';
}) => {
	await Database.query.task(async (task) => {
		let sql = `	INSERT INTO v1.users (
					active,
					details,
					last_login,
					registered_on,
					unique_id, 
					login_provider, 
					country) 
					
					VALUES (
						true, 
						'${JSON.stringify(details)}', 
						'${getSystemISOString()}', 
						'${getSystemISOString()}', 
						'${user.uid}', 
						'${provider || ''}', 
						'${userCountry}')`;
		await task.none(sql).catch((err) => {
			console.log(err);
		});
		const lastReferralCode = (await task.one('SELECT referral_code from v1.referral_code_tracker;'))
			.referral_code;
		const newReferralCode = getNewReferralCode({ lastReferralCode });
		await task.none(`UPDATE v1.referral_code_tracker SET referral_code = '${newReferralCode}'`);
		sql = `INSERT INTO v1.referral_code(unique_id, referral_code) VALUES ('${user.uid}','${newReferralCode}')`;
		await task.none(sql);
		sendWelcomeEmail({
			fullName: details.profile.fullName,
			email: details.profile.email,
			phone: details.profile.phone,
			country: userCountry,
		} as any);
	});
};

function getNewReferralCode({ lastReferralCode }: { lastReferralCode: string }) {
	const splitData = lastReferralCode.split('').reverse();

	let canUpdate = false;
	let counter = 0;
	while (!canUpdate) {
		const value = splitData[counter];
		if (value >= 'Z') {
			splitData[counter] = 'A';
			counter++;
		} else {
			canUpdate = true;
		}
	}

	if (counter === splitData.length) {
		throw new Error('Max Limit reached');
	}

	splitData[counter] = String.fromCharCode(splitData[counter].charCodeAt(0) + 1);

	return splitData.reverse().join('');
}

export const addUserApi_UP = async (request: Request, response: Response) => {
	let hasError = false;
	function sendApiRes(code: number, description: string, result?: any) {
		const status = new Status();
		hasError = code !== 200;
		sendResponse({
			status: { ...status, code, description },
			result,
			response,
			request,
		});
	}

	const user = await isUserAuthenticated({ request }).catch((err) => {
		const { code, error } = err;
		sendApiRes(code, 'You must be logged in to continue...');
	});

	if (hasError) {
		return;
	}

	const { fullName, avatarUrl, email, provider, country, phoneWithCountryCode } = request.body;
	const details: DBUserDetails = {
		profile: {
			avatarUrl: avatarUrl ? avatarUrl : '',
			email,
			fullName,
			phone: phoneWithCountryCode,
		},
		shipping: {} as IShippingDetails,
	};

	const dbRes = await addNewUserToDB_UP({
		details,
		user: { uid: user && user.uid },
		provider: provider || '',
		userCountry: getShortFormCountry(country),
	}).catch((e) => {
		console.error(`DB Error: ${addUserApi_UP.name}`, e);
		sendApiRes(500, 'adding user got error');
	});
	if (hasError) {
		return;
	}
	sendApiRes(200, '', dbRes);
};

export const updateProfilePictureApi_UP = async (request: Request, response: Response) => {
	const status = new Status();
	let hasError = false;
	function sendApiRes(code: number, description: string, result?: any) {
		const status = new Status();
		hasError = code !== 200;
		sendResponse({
			status: { ...status, code, description },
			result,
			response,
			request,
		});
	}

	const user = await isUserAuthenticated({ request }).catch((err) => {
		const { code, error } = err;
		sendApiRes(code, 'You must be logged in to continue...');
	});

	if (hasError) {
		return;
	}
	const { avatar } = request.body;

	const sql = `UPDATE v1.users
		SET details = jsonb_set(details, '{profile,avatarUrl}', '"${avatar.link}"', true)
		WHERE unique_id = '${user && user.uid}'`;

	const dbRes = await Database.query.none(sql).catch((e) => {
		console.error(`DB Error: ${updateProfilePictureApi_UP.name}`, e);
		status.code = 500;
	});
	sendResponse({ status, result: dbRes, response, request });
};

export const getUserProfileDB_UP = async ({ userId }: { userId: string }): Promise<IUserInDB> => {
	const sql = `
		SELECT 
		u.unique_id as uid,
		u.details->'profile'->>'email' AS "email",
		u.details->'profile'->>'fullName' AS "fullName",
		u.country AS "country", 
		COALESCE(u.details->'profile'->>'avatarUrl', '') AS "avatarUrl",
		u.details->'profile'->'phone' as "phone"
		FROM v1.users AS u 
		WHERE u.unique_id='${userId}'`;
	return await Database.query.oneOrNone<IUserInDB>(sql);
};

export const getUserProfileApi_UP = async (request: Request, response: Response) => {
	let hasError = false;
	function sendApiRes(code: number, description: string, result?: any) {
		const status = new Status();
		hasError = code !== 200;
		sendResponse({
			status: { ...status, code, description },
			result,
			response,
			request,
		});
	}

	await isUserAuthenticated({ request }).catch((err) => {
		const { code, error } = err;
		sendApiRes(code, 'You must be logged in to continue...');
	});

	if (hasError) {
		return;
	}

	const { uid } = request.query as { uid: string };
	let dbRes = await getUserProfileDB_UP({ userId: uid }).catch((e) => {
		console.error(`DB Error: ${getUserProfileApi_UP.name}`, e);
		sendApiRes(500, 'error happened during fetching user country');
	});
	if (hasError) {
		return;
	}
	if (dbRes) {
		const userCountry = dbRes?.country;
		(dbRes as unknown as IUserProfileApiResponse).country = getFullCountryName(userCountry);
	}
	sendApiRes(200, 'user-not-found', dbRes);
};

export const updateUserContactApi_UP = async (request: Request, response: Response) => {
	const status = new Status();
	let hasError = false;
	function sendApiRes(code: number, description: string, result?: any) {
		const status = new Status();
		hasError = code !== 200;
		sendResponse({
			status: { ...status, code, description },
			result,
			response,
			request,
		});
	}

	const user = await isUserAuthenticated({ request }).catch((err) => {
		const { code, error } = err;
		sendApiRes(code, 'You must be logged in to continue...');
	});

	if (hasError) {
		return;
	}

	const { phoneWithCountryCode } = request.body;
	const { code, number } = phoneWithCountryCode;

	if (!(PHONE_NUMBER_REGEX.test((number || 0).toString()) && NUMBER_REGEX.test((code || 0).toString()))) {
		sendApiRes(400, 'Values passed are incorrect');
		return;
	}
	let dbRes;
	if (user && user.uid) {
		const sql = `
		UPDATE v1.users as u set details =
		jsonb_set(details, '{profile,phone}', '${JSON.stringify(phoneWithCountryCode)}', true)
		WHERE u.unique_id='${user && user.uid}'`;
		dbRes = await Database.query.none(sql).catch((e) => {
			console.error(`DB Error: ${updateUserContactApi_UP.name}`, e);
			status.code = 500;
		});
	} else {
		status.code = 500;
	}

	sendApiRes(200, '', dbRes);
};

export const updateUserFullNameApi_UP = async (request: Request, response: Response) => {
	const status = new Status();
	let hasError = false;
	function sendApiRes(code: number, description: string, result?: any) {
		const status = new Status();
		hasError = code !== 200;
		sendResponse({
			status: { ...status, code, description },
			result,
			response,
			request,
		});
	}

	const user = await isUserAuthenticated({ request }).catch((err) => {
		const { code, error } = err;
		sendApiRes(code, 'You must be logged in to continue...');
	});

	if (hasError) {
		return;
	}

	const { fullName } = request.body;
	let dbRes;
	const sql = `
		UPDATE v1.users as u set details =
		jsonb_set(details, '{profile,fullName}', '"${fullName}"', true)
		WHERE u.unique_id='${user && user.uid}'`;
	dbRes = await Database.query.none(sql).catch((e) => {
		console.error(`DB Error: ${updateUserFullNameApi_UP.name}`, e);
		sendApiRes(500, 'db-error', null);
	});

	if (hasError) {
		return;
	}
	sendApiRes(200, '', dbRes);
};
export const updateUserEmailApi_UP = async (request: Request, response: Response) => {
	let hasError = false;
	function sendApiRes(code: number, description: string, result?: any) {
		const status = new Status();
		hasError = code !== 200;
		sendResponse({
			status: { ...status, code, description },
			result,
			response,
			request,
		});
	}

	const user = await isUserAuthenticated({ request }).catch((err) => {
		const { code, error } = err;
		sendApiRes(code, 'You must be logged in to continue...');
	});

	if (hasError) {
		return;
	}

	const { email } = request.body;
	const sql = `
		UPDATE v1.users as u set details =
		jsonb_set(details, '{profile,email}', '"${email}"', true)
		WHERE u.unique_id='${user && user.uid}'`;

	await Database.query.none(sql).catch((e) => {
		console.error(`DB Error: ${updateUserFullNameApi_UP.name}`, e);
		sendApiRes(500, 'db-error', null);
	});

	if (hasError) {
		return;
	}
	sendApiRes(200, '', null);
};

export const updateUserCountryApi_UP = async (request: Request, response: Response) => {
	const status = new Status();
	let hasError = false;
	function sendApiRes(code: number, description: string, result?: any) {
		const status = new Status();
		hasError = code !== 200;
		sendResponse({
			status: { ...status, code, description },
			result,
			response,
			request,
		});
	}

	const user = await isUserAuthenticated({ request }).catch((err) => {
		const { code, error } = err;
		sendApiRes(code, 'You must be logged in to continue...');
	});

	if (hasError) {
		return;
	}

	const { country } = request.body as { country: TLongCountryCodes };
	let dbRes;
	const sql = `
		UPDATE v1.users as u set country ='${getShortFormCountry(country)}'
		WHERE u.unique_id='${user && user.uid}'`;
	dbRes = await Database.query.none(sql).catch((e) => {
		console.error(`DB Error: ${updateUserCountryApi_UP.name}`, e);
		sendApiRes(500, 'db-error', null);
	});

	sendApiRes(200, '', dbRes);
};
export const updateUserLastLoginApi_UP = async (request: Request, response: Response) => {
	const status = new Status();
	let hasError = false;
	function sendApiRes(code: number, description: string, result?: any) {
		const status = new Status();
		hasError = code !== 200;
		sendResponse({
			status: { ...status, code, description },
			result,
			response,
			request,
		});
	}

	const user = await isUserAuthenticated({ request }).catch((err) => {
		const { code, error } = err;
		sendApiRes(code, 'You must be logged in to continue...');
	});

	if (hasError) {
		return;
	}
	let dbRes;
	if (user && user.uid) {
		const sql = `
		UPDATE v1.users set last_login ='${getSystemISOString()}'	WHERE unique_id='${user.uid}'`;
		dbRes = await Database.query.none(sql).catch((e) => {
			console.error(`DB Error: ${updateUserLastLoginApi_UP.name}`, e);
			status.code = 500;
		});
	} else {
		status.code = 500;
	}

	sendResponse({ status, result: dbRes, response, request });
};

export const getShippingAddressApi_UP = async (request: Request, response: Response) => {
	const status = new Status();
	const user = await isUserAuthenticated({ request });
	const sql = `
  SELECT details->'shipping'     as "shipping"
  FROM v1.users
  WHERE unique_id = '${user.uid}';
  `;
	const result = await Database.query.oneOrNone(sql).catch((e) => {
		console.error(`DB Error: ${getShippingAddressApi_UP.name}`, e);
		status.code = 500;
	});

	sendResponse({ status, result: result.shipping || null, response, request });
};

export const updateShippingAddressApi_UP = async (request: Request, response: Response) => {
	const status = new Status();
	const user = await isUserAuthenticated({ request });
	const shippingAddress = request.body;
	const sql = `
  UPDATE v1.users as u SET details =
  jsonb_set(details, '{shipping}', '${JSON.stringify(shippingAddress)}', true)
  WHERE unique_id = '${user.uid}';
  `;
	const result = await Database.query.none(sql).catch((e) => {
		console.error(`DB Error: ${getShippingAddressApi_UP.name}`, e);
		status.code = 500;
	});

	sendResponse({ status, result, response, request });
};

export const getUserCountry = async ({
	authorizationKeyValMap,
}: {
	authorizationKeyValMap: AuthorizationHeaderKeyValues | void;
}): Promise<TShortCountryCodes> => {
	const { uid: userId = null } = authorizationKeyValMap || {};
	let country: TShortCountryCodes = 'sg';
	if (!userId) {
		return country;
	}

	country = (await getUserProfileDB_UP({ userId }))?.country || 'sg';
	return country;
};
