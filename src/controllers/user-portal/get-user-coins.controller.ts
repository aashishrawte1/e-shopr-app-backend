import { Request, Response } from 'express';
import { getUserCountry } from '.';
import { Database } from '../../database';
import { getSystemISOString, isUserAuthenticated, parseAuthorizationHeader } from '../../util';
import { sendResponse, Status } from '../../util/log-response.util';

export const coinConversionInfo = {
	sg: { type1: { count: '100000', value: '1', currency: 'sgd' } },
	my: { type1: { count: '100000', value: '3', currency: 'myr' } },
};
const PRICE_DECIMAL_COUNT = 4;
type TCoinTypes = 'type1';
export const getUserCoinsFromDB = async ({
	uid,
	country,
}): Promise<
	{
		[key in TCoinTypes]: {
			count: string;
			value: string;
			coinConversionRate: string;
		};
	}
> => {
	const sql = `SELECT 	
		details
		FROM v1.coin_wallet 
		WHERE user_id='${uid}' AND 
		country='${country}'`;
	let dbRes = await Database.query.oneOrNone(sql);

	const currentTimeStamp = getSystemISOString();
	if (!dbRes) {
		const country = await getUserCountry({ authorizationKeyValMap: { uid, refreshToken: null } });
		let sql = `INSERT INTO v1.coin_wallet (user_id, details, country) VALUES (
			'${uid}', '${JSON.stringify({
			type1: {
				count: 0,
				updatedOn: currentTimeStamp,
			},
		})}', 
		'${country}'
		);`;

		await Database.query.none(sql);
		dbRes = {
			details: {
				type1: {
					count: 0,
					value: 0,
					coinConversionRate: coinConversionInfo[country].type1.count,
				},
			},
		};
	}
	dbRes = dbRes?.details;

	if (dbRes) {
		Object.keys(coinConversionInfo.my).forEach((key) => {
			dbRes[key].value = (dbRes[key].count / coinConversionInfo[country].type1.count).toFixed(
				PRICE_DECIMAL_COUNT
			);
			dbRes[key].coinConversionRate = coinConversionInfo[country].type1.count;
			delete dbRes[key].updatedOn;
		});
	}
	return dbRes;
};

export const getCoinsForUser_Api = async (request: Request, response: Response) => {
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
	const authorizationKeyValMap = parseAuthorizationHeader(request);
	const country = await getUserCountry({ authorizationKeyValMap });
	if (hasError) {
		return;
	}

	const { uid } = user || {};

	// type1 = greenGems
	let dbRes;
	if (user && uid) {
		dbRes = await getUserCoinsFromDB({ uid, country }).catch((e) => {
			console.error(`DB Error: ${getCoinsForUser_Api.name}`, e);
			sendApiRes(500, 'db-error');
		});
	}

	if (hasError) {
		return;
	}
	sendApiRes(200, '', dbRes);
};
