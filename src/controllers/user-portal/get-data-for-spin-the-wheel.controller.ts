import { Request, Response } from 'express';
import { getUserCountry } from '.';
import { Database } from '../../database';
import { parseAuthorizationHeader } from '../../util';
import { sendResponse, Status } from '../../util/log-response.util';
import { getLinksFromDB_UP } from './get-articles.controller';
import { getSQLQueryForProductsWithOptions } from './get-products-based-on-query';

export const getDataForSpinTheWheelApi_UP = async (request: Request, response: Response) => {
	const status = new Status();
	const body = request.query as {
		tags: string;
		table: string;
	};

	if (!body.table) {
		sendResponse({
			status: { ...status, code: 405, description: [`authorization failed`] },
			result: null,
			response,
			request,
		});
	}
	const authorizationKeyValMap = parseAuthorizationHeader(request);
	const country = await getUserCountry({ authorizationKeyValMap });
	const table = body.table.split(',');
	const promises = [];
	for (let tbl of table) {
		tbl = tbl.trim();
		if (tbl === 'products') {
			promises.push({
				type: 'products',
				data: await Database.query
					.manyOrNone(
						getSQLQueryForProductsWithOptions({
							...(request.query as any),
							orderBy: 'random()',
							country: country,
						})
					)
					.catch((e) => {
						console.error(`DB Error: ${getDataForSpinTheWheelApi_UP.name}`, e);
						status.code = 500;
					}),
			});
		} else if (tbl === 'link') {
			promises.push({
				type: 'link',
				data: await getLinksFromDB_UP({ ...(request.query as any), limit: 10, orderBy: 'random()' }).catch(
					(e) => {
						console.error(`DB Error: ${getDataForSpinTheWheelApi_UP.name}`, e);
						status.code = 500;
					}
				),
			});
		}
	}

	const dbRes = {
		products: [],
		links: [],
		tags: body.tags,
		type: body.table,
	};
	const resolutions = await Promise.all(promises);
	resolutions.forEach((resolution) => {
		if (resolution.type === 'link') {
			dbRes.links = resolution.data;
		}
		if (resolution.type === 'products') {
			dbRes.products = resolution.data;
		}
	});

	sendResponse({ status, result: dbRes, response, request });
};
