import { Request, Response } from 'express';
import { Status, sendResponse } from '../../util/log-response.util';
import { Database } from '../../database';
import { isUserAuthenticated, parseAuthorizationHeader } from '../../util';
import { getUserCountry } from '.';

export const getOrderListForUserApi = async (request: Request, response: Response) => {
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
	let dbRes;
	const sql = `SELECT 
o.unique_id  as "uniqueId",
o.ordered_at  as "ordered_at",
o.details#>'{payment}' as "payment",
o.details#>'{discount}' as "discount",
o.details#>'{discountType}' as "discountType",
o.details#>'{shoppingCart}'  as "products",
o.order_referenceid as "referenceId"
FROM "v1".orders as o where o.ordered_by='${
		user && user.uid
	}' and o.country='${country}' order by o.order_referenceid asc ;`;
	dbRes = await Database.query.manyOrNone(sql).catch((e) => {
		console.error(`DB Error: ${getOrderListForUserApi.name}`, e);
		sendApiRes(500, 'error in db');
	});
	if (hasError) {
		return;
	}
	sendApiRes(200, '', dbRes);
};
