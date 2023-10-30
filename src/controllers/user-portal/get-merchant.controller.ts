import { Request, Response } from 'express';
import { Status, sendResponse } from '../../util/log-response.util';
import { Database } from '../../database';
import { getUserCountry } from '.';
import { parseAuthorizationHeader } from '../../util';

export const getMerchantListApi_UP = async (request: Request, response: Response) => {
	const status = new Status();
	const authorizationKeyValMap = parseAuthorizationHeader(request);
	const country = await getUserCountry({ authorizationKeyValMap });
	const sql = `
SELECT
	m.unique_id as "uniqueId",
	m.details#>>'{profile,avatarUrl}' as "avatarUrl",
	m.details#>>'{profile,fullName}' as "fullName"
	from v1.products as p 
INNER JOIN 
v1.merchant as m
ON
	p.owner = m.unique_id
	WHERE p.verified = true AND p.selling_countries @> '["${country}"]' AND p.details->'active'='true'
GROUP BY 
	m.unique_id, 
	p.owner, 
	m.details#>>'{profile,avatarUrl}', 
	m.details#>>'{profile,fullName}' 
ORDER by m.details#>>'{profile,fullName}' asc;
	`;
	const dbRes = await Database.query.manyOrNone(sql).catch((e) => {
		console.error(`DB Error: ${getMerchantListApi_UP.name}`, e);
		status.code = 500;
	});

	sendResponse({ status, result: dbRes, response, request });
};
