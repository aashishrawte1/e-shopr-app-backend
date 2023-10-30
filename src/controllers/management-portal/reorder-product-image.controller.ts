import { Request, Response } from 'express';
import { Database } from '../../database';
import { sendResponse, Status } from '../../util/log-response.util';
import { getMerchantProfileDB_MP } from '.';
import { isUserAuthenticated } from '../../util';

export const reorderProductImageApi_MP = async (request: Request, response: Response) => {
	const status = new Status();
	const data = request.body;

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
		console.error({ authorization: request.headers.authorization }, error, 'merchant profile not present');
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
	const sql = `update v1.products set details=jsonb_set(details, '{media}', '${JSON.stringify(data.media)}') 
  where unique_id='${data.unique_id}';`;
	const dbRes = await Database.query.none(sql).catch((e) => {
		console.error(`DB Error: ${reorderProductImageApi_MP.name}`, e);
		status.code = 500;
	});

	sendResponse({ status, result: dbRes, response, request });
};
