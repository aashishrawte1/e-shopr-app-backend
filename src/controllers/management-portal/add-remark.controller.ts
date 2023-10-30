import { Status, sendResponse } from '../../util/log-response.util';
import { Database } from '../../database';
import { Request, Response } from 'express';
import { getMerchantProfileDB_MP } from '.';
import { isUserAuthenticated } from '../../util';
export const addRemarkApi_MP = async (request: Request, response: Response) => {
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

	const sql = `update v1.orders
set
  details = jsonb_set(
    details,
    '{remark}',
    '"${remark}"',
    true
  )
where
  unique_id ='${orderId}';`;

	const dbRes = await Database.query.none(sql).catch((e) => {
		console.error(`DB Error: ${addRemarkApi_MP.name}`, e);
		status.code = 204;
	});
	sendResponse({ status, result: dbRes, response, request });
};
