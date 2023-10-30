import { Request, Response } from 'express';
import { Database } from '../../database';
import { sendResponse, Status } from '../../util/log-response.util';
import { parseAuthorizationHeader } from '../../util';
import { getSQLQueryForProductsWithOptions } from './get-products-based-on-query';
import { getUserCountry } from './user.controller';
export async function getProductDetailApi_UP(request: Request, response: Response) {
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

	const authorizationKeyValMap = parseAuthorizationHeader(request);
	const { uid: userId = null } = authorizationKeyValMap;
	const { uniqueId: productId } = request.query as { uniqueId: string };
	const country = await getUserCountry({ authorizationKeyValMap });
	const sql = getSQLQueryForProductsWithOptions({
		statistics: { show: true, userId },
		sorting: 'best-match',

		productDetail: true,
		filters: {
			idList: [productId],
		},
		country,
	});
	let dbRes = await Database.query.oneOrNone(sql).catch((e) => {
		sendApiRes(500, 'db-fetch-error');
	});
	let relatedItemTags = [];
	for (let tag of Object.keys(dbRes.tags)) {
		if (dbRes.tags[tag] == 1 || dbRes.tags[tag] == 2 || dbRes.tags[tag] == 3 || dbRes.tags[tag] == 4)
			relatedItemTags.push(tag);
	}
	dbRes = {
		...dbRes,
		relatedItemTags,
	};
	if (hasError) {
		return;
	}

	sendApiRes(200, '', dbRes);
}
