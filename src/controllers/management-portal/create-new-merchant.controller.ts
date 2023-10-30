import { Request, Response } from 'express';
import { Database } from '../../database';
import { MerchantDetails } from '../../models';
import { isUserAuthenticated } from '../../util';
import { sendResponse, Status } from '../../util/log-response.util';

export const createNewMerchantApi_MP = async (request: Request, response: Response) => {
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

	const { fullName, avatarUrl, email } = request.body;
	const merchantDetails: MerchantDetails = {
		profile: {
			avatarUrl: avatarUrl ? avatarUrl : '',
			email,
			fullName,
			isAdmin: false,
		},
	};
	const sql = `INSERT INTO v1.merchant (
    active,
    details,
    last_login,
    registered_on,
    unique_id
  ) VALUES (true, '${JSON.stringify(merchantDetails)}', now(), now(), '${user && user.uid}');`;

	await Database.query.none(sql).catch((e) => {
		console.error(`DB Error: ${createNewMerchantApi_MP.name}`, e);
		status.code = 500;
	});

	const userDetails: MerchantDetails = {
		profile: {
			avatarUrl: avatarUrl ? avatarUrl : '',
			email,
			fullName,
			isAdmin: false,
		},
	};
	sendResponse({ status, result: '', response, request });
};
