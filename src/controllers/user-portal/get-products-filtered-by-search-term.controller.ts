import { Request, Response } from 'express';
import { getSQLQueryForProductsWithOptions, getUserCountry } from '.';
import { Database } from '../../database';
import { ProductSortingType } from '../../models';
import { parseAuthorizationHeader } from '../../util';
import { sendResponse, Status } from '../../util/log-response.util';
export const getProductsBySearchTermApi_UP = async (request: Request, response: Response) => {
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

	const { searchTerm, byOwnerId, sorting, start, end } = request.query as unknown as {
		searchTerm: string;
		byOwnerId: string;
		sorting: ProductSortingType;
		start: number;
		end: number;
	};

	const authorizationKeyValMap = parseAuthorizationHeader(request);
	const country = await getUserCountry({ authorizationKeyValMap });
	const sql = getSQLQueryForProductsWithOptions({
		start,
		end,
		sorting,
		filters: {
			searchOnTitle: searchTerm,
			byOwnerId,
		},
		country,
	});
	const dbRes = await Database.query.manyOrNone(sql).catch((_) => {
		sendApiRes(500, 'got issue, could not get products');
	});

	if (hasError) {
		return;
	}

	sendApiRes(200, '', dbRes);
};
