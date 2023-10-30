import { Request, Response } from 'express';
import { Database } from '../../database';
import { sendResponse, Status } from '../../util/log-response.util';
import { getMerchantProfileDB_MP } from '.';
import { isUserAuthenticated } from '../../util';

export const getAllUsersApi_MP = async (request: Request, response: Response) => {
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
	const merchant = await getMerchantProfileDB_MP({ uid: user && user.uid }).catch(async (error) => {
		console.error({ authorization: request.headers.authorization }, error);
		sendResponse({
			status: { ...status, code: 405, description: [`authorization failed`] },
			result: null,
			response,
			request,
		});
	});

	if (!(merchant && merchant.isAdmin)) {
		sendResponse({
			status: { ...status, code: 405, description: [`authorization failed`] },
			result: null,
			response,
			request,
		});
	}
	const sql = `SELECT 
u.unique_id  as "uniqueId",
u.details#>'{profile,email}' as "email",
u.details#>'{profile,fullName}' as "fullName",
u.details#>'{profile,avatarUrl}' as "avatarUrl",
u.last_login  as "lastLogin",
u.registered_on  as "registeredOn"

FROM "v1".users as u order by registered_on desc;`;
	const dbRes = await Database.query.manyOrNone(sql).catch((e) => {
		console.error(`DB Error: ${getAllUsersApi_MP.name}`, e);
		status.code = 500;
	});

	sendResponse({ status, result: dbRes, response, request });
};
