import { Status, sendResponse } from '../../util/log-response.util';

import { Database } from '../../database';
import { Request, Response } from 'express';
import { isUserAuthenticated } from '../../util';

export const getMerchantProfileDB_MP = async (options: { uid: string }) => {
	if (!options.uid) {
		console.error('no uid present');
		return;
	}

	const sql = `
		SELECT 
		u.details->'profile'->>'fullName' AS "fullName", 
		COALESCE(u.details->'profile'->>'avatarUrl', '') AS "avatarUrl",
		u.details->>'points' AS "points",
		u.details->'profile'->>'phone' as "phone",
		u.details->'profile'->>'isAdmin' as "isAdmin"
		FROM v1.merchant AS u 
		WHERE u.unique_id='${options.uid}'`;
	return await Database.query.one(sql);
};

export const getMerchantProfileApi_MP = async (request: Request, response: Response) => {
	const status = new Status();

	const { orderId, remark } = request.body;
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

	const dbRes = await getMerchantProfileDB_MP({ uid: user && user.uid }).catch((e) => {
		console.error(`DB Error: ${getMerchantProfileApi_MP.name}`, e);
		status.code = 500;
	});

	sendResponse({ status, result: dbRes, response, request });
};
