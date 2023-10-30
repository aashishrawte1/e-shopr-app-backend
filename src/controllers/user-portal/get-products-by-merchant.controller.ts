import { Request, Response } from 'express';
import { getSQLQueryForProductsWithOptions, getUserCountry } from '.';
import { Database } from '../../database';
import { ProductSortingType } from '../../models';
import { parseAuthorizationHeader } from '../../util';
import { sendResponse, Status } from '../../util/log-response.util';
export const getProductsByOwnerApi_UP = async (request: Request, response: Response) => {
	const status = new Status();

	const { start, end, sorting } = (request.query as unknown) as {
		start: number;
		end: number;
		sorting: ProductSortingType;
	};
	const authorizationKeyValMap = parseAuthorizationHeader(request);
	const country = await getUserCountry({ authorizationKeyValMap });
	const dbRes = await Database.query
		.manyOrNone(
			getSQLQueryForProductsWithOptions({
				start,
				end,
				sorting,
				filters: {
					byOwnerId: request.query.ownerId?.toString()?.replace(/ /g, '+') as string,
				},
				country,
			})
		)
		.catch(async (_) => {
			console.error(`${getProductsByOwnerApi_UP.name} threw error`);
			status.code = 500;
		});

	sendResponse({ status, result: dbRes, response, request });
};
