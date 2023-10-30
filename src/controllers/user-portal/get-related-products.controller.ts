import { Request, Response } from 'express';
import { sendResponse, Status } from '../../util/log-response.util';
import { getSQLQueryForProductsWithOptions } from './get-products-based-on-query';
import { Database } from '../../database';
import { ProductSortingType } from '../../models';
import { parseAuthorizationHeader } from '../../util';
import { getUserCountry } from '.';

export const getRelatedProducts_API = async (request: Request, response: Response) => {
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

	const { start, end, sorting, tags } = request.query as unknown as {
		start: number;
		end: number;
		tags: string;
		sorting: ProductSortingType;
	};

	const authorizationKeyValMap = parseAuthorizationHeader(request);
	const country = await getUserCountry({ authorizationKeyValMap });

	const sql = getSQLQueryForProductsWithOptions({ start, end, tags, sorting, country });
	const dbRes = await Database.query.manyOrNone(sql).catch((_) => {
		sendApiRes(500, 'got issue, could not get forage items');
	});

	if (hasError) {
		return;
	}

	sendApiRes(200, '', dbRes);
};
