import { Request, Response } from 'express';
import { getSQLQueryForProductsWithOptions, getUserCountry } from '.';
import { Database } from '../../database';
import { ProductSortingType } from '../../models';
import { parseAuthorizationHeader } from '../../util';
import { sendResponse, Status } from '../../util/log-response.util';
export const getProductsByPagination_API = async (request: Request, response: Response) => {
	const status = new Status();

	const { start, end, sorting, tags } = (request.query as unknown) as {
		start: number;
		end: number;
		sorting: ProductSortingType;
		tags: string;
	};

	const authorizationKeyValMap = parseAuthorizationHeader(request);
	const country = await getUserCountry({ authorizationKeyValMap });
	const dbRes = await Database.query
		.manyOrNone(getSQLQueryForProductsWithOptions({ start, end, tags, sorting, country }))
		.catch(async (error) => {
			status.code = 500;
		});

	sendResponse({
		status,
		result: dbRes,
		response,
		request,
	});
};
