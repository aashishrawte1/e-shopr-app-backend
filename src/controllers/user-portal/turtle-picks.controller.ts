import { Request, Response } from 'express';
import { getUserCountry } from '.';
import { Database } from '../../database';
import { isProductionEnvironment, isUserAuthenticated } from '../../util';
import { sendResponse, Status } from '../../util/log-response.util';
export const getTurtlePicks_API = async (request: Request, response: Response) => {
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

	const authorizationKeyValMap = await isUserAuthenticated({ request }).catch((error) => {});
	const country = await getUserCountry({ authorizationKeyValMap });
	let dbRes;

	const sql = `
  WITH top_products as (
		select p.unique_id as "uniqueId", 
  p.owner											as "owner",
  jsonb_build_array(p.details#>'{media, 0}')	  		as "media",
  count(p.unique_id) as "numberOfLikes"
  FROM v1.products as p
  INNER JOIN v1.product_like_tracker as l ON p.unique_id = l.product_id
  GROUP BY p.unique_id
  HAVING p.selling_countries @> '["${country}"]' AND count(p.unique_id) > ${isProductionEnvironment() ? 1 : 0}
  AND p.details->'active'='true'
	limit 40) 
  select * from top_products order by random()`;
	dbRes = await Database.query.manyOrNone(sql).catch((e) => {
		console.error(`DB Error: ${getTurtlePicks_API.name}`, e);
		sendApiRes(500, 'db-error for likes', null);
	});

	if (hasError) {
		return;
	}

	sendApiRes(200, '', dbRes);
};
