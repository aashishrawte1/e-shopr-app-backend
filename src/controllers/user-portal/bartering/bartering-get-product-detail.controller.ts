import { Request, Response } from 'express';
import { getRelevantProductsSQL } from '.';
import { getUserCountry } from '..';
import { Database } from '../../../database';
import { Status, sendResponse, isUserAuthenticated } from '../../../util';

export const barteringGetProductDetailWithRelevanceApi = async (request: Request, response: Response) => {
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

	const { uid: userId = null } = user || {};
	const country = await getUserCountry({ authorizationKeyValMap: user });
	const { sourceProductId, targetProductId } = request.query as {
		sourceProductId: string;
		targetProductId: string;
	};

	const productsWithRelevanceSQL = await getRelevantProductsSQL({
		sourceProductId,
		country,
		userId,
		withDescription: true,
	});
	let dbRes: any;
	const sql = `
	SELECT * FROM ${productsWithRelevanceSQL} as items_with_relevance
	WHERE items_with_relevance."productId"='${targetProductId}' ;`;
	dbRes = await Database.query.manyOrNone(sql).catch((e) => {
		console.error(`DB Error: ${barteringGetProductDetailWithRelevanceApi.name}`, e);
		sendApiRes(500, 'error');
	});
	if (hasError) {
		return;
	}
	sendApiRes(200, '', dbRes);
};

export const barteringGetProductDetailApi = async (request: Request, response: Response) => {
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

	const { uid = null } = user || {};
	const { productId } = request.query;

	const sqlForSelectedProduct = `
	SELECT 
	product_list.product_id as "productId",
	product_list.posted_by  as "postedBy",
	product_list.title as "title",
	product_list.description as "description",
	product_list.price_min  as "priceMin",
	product_list.price_max as "priceMax",
	product_list.images as "images"
	FROM v1.bartering_product_list as product_list
	WHERE
	product_id = '${productId}';
	`;

	const dbRes = await Database.query.one(sqlForSelectedProduct).catch((e) => {
		console.error(`DB Error: ${barteringGetProductDetailWithRelevanceApi.name}`, e);
		sendApiRes(500, 'error');
	});
	if (hasError) {
		return;
	}
	sendApiRes(200, '', dbRes);
};
