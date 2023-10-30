import { Request, Response } from 'express';
import { getMerchantProfileDB_MP } from '.';
import { Database } from '../../database';
import { isUserAuthenticated } from '../../util';
import { sendResponse, Status } from '../../util/log-response.util';
export const getOrdersApi_MP = async (request: Request, response: Response) => {
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

	let sql = `
	SELECT 
	o.unique_id  as "orderId",
	o.order_referenceid  as "orderNumber",
	o.ordered_at  as "ordered_at",
	o.details#>'{payment, amount}' as "payment",
	o.details#>'{discount}' as "discount",
	o.details#>'{discountType}' as "discountType",
	o.details#>'{shoppingCart}'  as "orderDetail",
	o.details#>'{remark}'  as "remark",
	o.details#>'{shippingDetails}'  as "shippingAddress", 
	u.country as "country"
	FROM v1.users as u
	INNER JOIN v1.orders as o ON o.ordered_by = u.unique_id  `;

	sql += ' order by ordered_at desc;';
	const dbRes = await Database.query.manyOrNone(sql).catch((e) => {
		console.error(`DB Error: ${getOrdersApi_MP.name}`, e);
		status.code = 500;
	});

	sendResponse({ status, result: dbRes, response, request });
};
