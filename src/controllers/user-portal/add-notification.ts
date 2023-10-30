import { Request, Response } from 'express';
import { Database } from '../../database';
import { sendResponse, Status } from '../../util/log-response.util';
import { isUserAuthenticated, getSystemISOString } from '../../util';

export const notificationLogDB_UP = async (request: Request, response: Response) => {
	let hasError = false;
	function sendApiRes(code: any, description: string, result?: any) {
		const status = new Status();
		hasError = code !== 200;
		sendResponse({
			status: { ...status, code, description },
			result,
			response,
			request,
		});
	}

	const user = await isUserAuthenticated({ request }).catch((err) => {
		const { code, error } = err;
		sendApiRes(code, 'You must be logged in to continue...');
	});

	if (hasError) {
		return;
	}

	const { multicast_id, message_id, status_type, user_id, extra } = request.body;

	const mid = JSON.stringify({ message_id });
	console.log(mid);
	let sql = `insert into v1.notification (multicast_id,message_id,status_type,user_id,sent_on,received_on,details) 
          values('${multicast_id}','${message_id}','${status_type}','${user_id}','${getSystemISOString()}',null,'${JSON.stringify(
		extra
	)}')`;

	const dbRes = await Database.query.none(sql).catch((e) => {
		sendApiRes(500, 'sql failed...');
	});

	if (hasError) {
		return;
	}

	sendApiRes(200, '', dbRes);
};
