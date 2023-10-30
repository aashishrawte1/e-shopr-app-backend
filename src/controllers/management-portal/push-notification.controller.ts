import { Request, Response } from 'express';
import { Database } from '../../database';
import { sendResponse, Status } from '../../util/log-response.util';
import { isUserAuthenticated, getSystemISOString } from '../../util';
import { getMerchantProfileDB_MP } from '.';

export const notificationLogDB_MP = async (request: Request, response: Response) => {
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
	const merchant = await getMerchantProfileDB_MP({ uid: user && user.uid }).catch(async (error) => {
		console.error({ authorization: request.headers.authorization }, error);
		sendApiRes(405, 'authorization failed');
	});

	if (hasError) {
		return;
	}

	if (!(merchant && merchant.isAdmin)) {
		sendApiRes(403, 'You must be admin to continue...');
	}

	if (hasError) {
		return;
	}
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

export const getRegistrationToken_MP = async (request: Request, response: Response) => {
	const status = new Status();
	const { uniqueId } = request.query;
	const sql = `SELECT token FROM v1.devices WHERE user_id='${uniqueId}'`;
	const dbRes = await Database.query.manyOrNone(sql).catch((e) => {
		console.error(`DB Error: ${getRegistrationToken_MP.name}`, e);
		status.code = 500;
	});
	sendResponse({ status, result: dbRes, response, request });
};

export const getAllRegistrationToken_MP = async (request: Request, response: Response) => {
	const status = new Status();
	const sql = `SELECT token,user_id as "uniqueId" FROM v1.devices`;
	const dbRes = await Database.query.manyOrNone(sql).catch((e) => {
		console.error(`DB Error: ${getRegistrationToken_MP.name}`, e);
		status.code = 500;
	});
	sendResponse({ status, result: dbRes, response, request });
};
