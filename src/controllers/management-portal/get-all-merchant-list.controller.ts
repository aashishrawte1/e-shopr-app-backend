import { Request, Response } from 'express';
import { Database } from '../../database';
import { Status, sendResponse } from '../../util/log-response.util';
import { getMerchantProfileDB_MP } from '.';
import { isUserAuthenticated } from '../../util';

export const getAllMerchantsDB_MP = async (options?: {}) => {
	const sql = `
    select * from v1.merchant;
  `;

	return await Database.query.manyOrNone(sql);
};

export const getMerchantListApi_MP = async (request: Request, response: Response) => {
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
	const merchant = await getMerchantProfileDB_MP({ uid: user && user.uid }).catch(async (error) => {
		console.error({ authorization: request.headers.authorization }, error);
		sendApiRes(400, 'db-error');
	});

	if (hasError) {
		return;
	}

	if (!(merchant && merchant.isAdmin)) {
		sendApiRes(400, 'lacks privileges');
		return;
	}

	const sql = `SELECT 
m.unique_id  as "uniqueId",
m.details#>'{profile,email}' as "email",
m.details#>'{profile,fullName}' as "fullName",
m.details#>'{profile,avatarUrl}' as "avatarUrl",
m.last_login  as "lastLogin",
m.registered_on  as "registeredOn"
FROM "v1".merchant as m order by registered_on desc;`;
	const dbRes = await Database.query.manyOrNone(sql).catch((e) => {
		console.error(`DB Error: ${getMerchantListApi_MP.name}`, e);
		sendApiRes(400, 'db-error');
	});
	if (hasError) {
		return;
	}

	sendApiRes(200, '', dbRes);
};
