import { Response, Request } from 'express';

import { Database } from '../../database';
import { sendResponse, Status } from '../../util/log-response.util';
export const getLoginProviderAPI_UP = async (request: Request, response: Response) => {
	const { email, provider } = request.body;

	const sql = `
  SELECT login_provider as "provider" FROM
  v1.users WHERE UPPER(details->'profile'->>'email') = UPPER('${email}')
  `;
	console.log({ email, provider });
	const status = new Status();
	const res = await Database.query.oneOrNone(sql).catch((error) => {
		status.code = 403;
		status.description = 'sql error';
	});
	sendResponse({ status, request, response, result: res });
};
