import { Request, Response } from 'express';
import { Status, sendResponse } from '../../util/log-response.util';
import { Database } from '../../database';

export const getCategoriesInPopularityOrder_API = async (request: Request, response: Response) => {
	const status = new Status();

	const sql = `select tags.tag as text, count(tags.tag) as tagCount from (select jsonb_object_keys(details->'tags') as tag FROM v1.products) as tags group by tags.tag order by tagCount desc limit 100`;

	const dbRes = await Database.query.manyOrNone(sql).catch((e) => {
		console.error(`DB Error: ${getCategoriesInPopularityOrder_API.name}`, e);
		status.code = 500;
	});

	sendResponse({ status, result: dbRes, response, request });
};
