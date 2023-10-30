import { format } from 'date-fns';
import { Request, Response } from 'express';
import { getUserCountry } from '.';
import { Database } from '../../database';
import { TShortCountryCodes } from '../../models';
import { getSystemISOString, isUserAuthenticated, parseAuthorizationHeader } from '../../util';
import { sendResponse, Status } from '../../util/log-response.util';
export type TCouponTypes = '$' | '%';
export const getCouponDetailsByCouponCode_API = async (request: Request, response: Response) => {
	const { couponCode } = request.query;
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

	if (!(couponCode && couponCode.length >= 3)) {
		sendApiRes(400, 'no voucher given');
		return;
	}

	const user = await isUserAuthenticated({ request }).catch((err) => {
		const { code } = err;
		sendApiRes(code, 'You must be logged in to continue...');
	});

	if (hasError) {
		return;
	}

	const authorizationKeyValMap = parseAuthorizationHeader(request);
	const country = await getUserCountry({ authorizationKeyValMap });
	const userId = user && user.uid;

	let result = await getCouponAvailability_DB({ couponCode: couponCode.toString(), userId, country });
	if (!!result?.claimedBy) {
		sendApiRes(200, '', { error: 'This voucher has been used already.' });
		return;
	}
	const sql = `SELECT 
      coupon_code  as "couponCode",
			coupon_value  as "couponValue",
			discount_type as "discountType", 
			country, 
			date(valid_till) as "validityUntil", 
			quantity
		FROM v1.coupon as coupon WHERE 
		UPPER(coupon_code)=UPPER('${couponCode}')`;
	const dbRes = await Database.query.oneOrNone(sql).catch((e) => {
		console.error(`DB Error: ${getCouponDetailsByCouponCode_API.name}`, e);
		sendApiRes(500, 'got db error');
	});
	if (hasError) {
		return;
	}

	if (!+dbRes.quantity) {
		sendApiRes(200, '', { error: 'All vouchers has been claimed' });
		return;
	}

	const currentDate = format(new Date(), 'yyyy-MM-dd');
	let voucherExpiryDateFormatted;
	if (dbRes) {
		voucherExpiryDateFormatted = format(dbRes.validityUntil, 'yyyy-MM-dd');
	} else {
		sendApiRes(200, '', {
			error: 'Invalid voucher',
		});
		return;
	}

	if (dbRes?.country !== country) {
		sendApiRes(200, '', {
			error: 'This voucher is not valid for your country',
		});
		return;
	}

	if (currentDate > voucherExpiryDateFormatted) {
		sendApiRes(200, '', {
			error: 'Voucher has expired.',
		});
		return;
	}

	delete dbRes.country;
	delete dbRes.validityUntil;
	sendApiRes(200, '', dbRes);
};

export const reduceQuantityOfCoupon_DB = async ({
	claimer,
	voucherCode,
	country,
}: {
	claimer: string;
	voucherCode: string;
	country: TShortCountryCodes;
}) => {
	const sql = `
	 -- Saving the coupon usage by user
	INSERT INTO 
	v1.coupon_tracker(claimed_by, coupon_code, applied_on, country) 
	VALUES('${claimer}','${voucherCode}','${getSystemISOString()}', '${country}'); 
	 -- Reducing quantity of coupons
	 UPDATE v1.coupon
	 SET quantity = quantity - 1
	 WHERE 
	 LOWER(coupon_code)=LOWER('${voucherCode}') AND
	 country = '${country}'
	 ;
	`;
	return await Database.query.none(sql);
};

export const getCouponValueFromDB_UP = async ({
	country,
	couponCode,
}: {
	couponCode: string;
	country: TShortCountryCodes;
}): Promise<{ couponValue: number; discountType: TCouponTypes }> => {
	const sql = `
	SELECT 
	coupon_value as "couponValue",
	discount_type as "discountType"	
	FROM v1.coupon 
	WHERE 
	UPPER(coupon_code)=UPPER('${couponCode}') AND 
	country = '${country}' AND
	valid_till >= current_date`;
	return await Database.query.oneOrNone(sql);
};
export const getCouponAvailability_DB = async ({
	couponCode,
	userId,
	country,
}: {
	couponCode: string;
	userId: string;
	country: TShortCountryCodes;
}) => {
	const checkCouponType = `SELECT 
	quantity 
	FROM v1.coupon 
	WHERE 
	UPPER(coupon_code)=UPPER('${couponCode}') AND
	country = '${country}'
	`;

	const result = await Database.query.oneOrNone(checkCouponType);
	let sql: string;
	if (+(result?.quantity || 0) > 1) {
		sql = `SELECT 
		claimed_by as "claimedBy" FROM 
		v1.coupon_tracker 
		WHERE 
		claimed_by='${userId}' AND 
		UPPER(coupon_code)=UPPER('${couponCode}') AND
		country = '${country}';
		`;
	} else {
		sql = `SELECT 
		claimed_by as "claimedBy" 
		FROM v1.coupon_tracker WHERE 
		UPPER(coupon_code)=UPPER('${couponCode}') AND
		country = '${country}';
		`;
	}
	return await Database.query.oneOrNone(sql);
};
