import { Request, Response } from 'express';

import { Database } from '../../../database';
import { Status, sendResponse, isUserAuthenticated, parseAuthorizationHeader } from '../../../util';
import { getUserCountry } from '../user.controller';
export const barteringDeleteProductApi = async (request: Request, response: Response) => {
	let hasError = false;
	function sendApiRes(code: any, description: string, result?: any) {
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

	const { uid } = user || {};
	const authorizationKeyValMap = parseAuthorizationHeader(request);
	const country = await getUserCountry({ authorizationKeyValMap });
	const { productId } = request.query;

	let sql = `delete from v1.bartering_product_list where product_id='${productId}' AND posted_by='${uid}' AND country='${country}'`;

	const dbRes = await Database.query.none(sql).catch((e) => {
		sendApiRes(500, 'sql failed...');
	});

	if (hasError) {
		return;
	}

	sendApiRes(200, '', dbRes);
};
