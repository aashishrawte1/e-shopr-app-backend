import { Request, Response } from 'express';
import { getUserCountry } from '..';
import { Database } from '../../../database';
import { Status, sendResponse, isUserAuthenticated } from '../../../util';

export const barteringGetAllProductsApi = async (request: Request, response: Response) => {
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

	const country = await getUserCountry({ authorizationKeyValMap: user });

	const { uid = null } = user || {};

	const sql = `
	SELECT 
	product_id  as "productId",
	posted_by  as "postedBy",
	title,
	description,
	images,
	price_min  as "priceMin",
	price_max as "priceMax",
	tags
	FROM "v1".bartering_product_list 
	WHERE posted_by='${uid}' AND
	country = '${country}' 
	ORDER BY product_id DESC ;`;
	let dbRes = await Database.query.manyOrNone(sql).catch((e) => {
		console.error(`DB Error: ${barteringGetAllProductsApi.name}`, e);
		sendApiRes(500, 'error in db');
	});
	if (hasError) {
		return;
	}
	sendApiRes(200, '', dbRes);
};
