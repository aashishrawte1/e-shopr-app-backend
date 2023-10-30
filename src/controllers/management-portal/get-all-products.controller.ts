import { Request, Response } from 'express';
import { Database } from '../../database';
import { sendResponse, Status } from '../../util/log-response.util';
import { getMerchantProfileDB_MP } from '.';
import { isUserAuthenticated } from '../../util';

export const getAllProductsApi_MP = async (request: Request, response: Response) => {
	const status = new Status();
	const search = Object.keys(request.query);

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
	let sql = `SELECT 
			p.unique_id             		as "uniqueId",
			p.owner											as "owner",
			p.details#>'{media}'	  		as "media",
			p.details->>'price'					as "price",
			p.details->>'title' 				as "title",
			p.details->'description' 	  as "description",
			p.details->'tags'				as "tags",
			merchant.details#>>'{profile,fullName}'  as "ownerName",
			merchant.details#>>'{profile,avatarUrl}'  as "avatarUrl"
			FROM v1.merchant as merchant
		INNER JOIN v1.products as p 
		ON p.owner = merchant.unique_id `;

	if (search && search.toString().trim().length > 3) {
		sql += ` where Upper(p.details->>'title')::text like UPPER('%${search.toString().trim()}%') `;
	}

	const dbRes = await Database.query.manyOrNone(sql).catch((e) => {
		console.error(`DB Error: ${getAllProductsApi_MP.name}`, e);
		status.code = 500;
	});

	sendResponse({ status, result: dbRes, response, request });
};
