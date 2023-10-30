import { Request, Response } from 'express';
import { sql } from 'googleapis/build/src/apis/sql';
import { getMerchantProfileDB_MP } from '.';
import { Database } from '../../database';
import { INotificationItem } from '../../models';
import { FirebaseNotification, isUserAuthenticated } from '../../util';
import { sendResponse, Status } from '../../util/log-response.util';

export const sendNotificationToAllUsers_API = async (request: Request, response: Response) => {
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

	const authorizationKeyValMap = await isUserAuthenticated({ request }).catch((err) => {
		const { code, error } = err;
		sendApiRes(code, 'You must be logged in to continue...');
	});

	if (hasError) {
		return;
	}

	// const { uid } = user || {};

	// let sql = `SELECT
	// 						u.unique_id as uid,
	// 						u.details->'profile'->>'fullName' as fullName,
	// 						c.details->'type1'->>'count' as gems
	// 						FROM v1.users as u LEFT JOIN v1.coin_wallet as c
	// 						on u.unique_id = c.user_id
	// 						where u.unique_id = ${uid};`;

	// const dbRes = await Database.query.one(sql).catch((e) => console.log(e));

	const merchant = await getMerchantProfileDB_MP({
		uid: authorizationKeyValMap && authorizationKeyValMap.uid,
	}).catch(async (error) => {
		console.error({ authorization: request.headers.authorization }, error);
		sendApiRes(405, 'authorization failed');
	});

	if (!(merchant && merchant.isAdmin === 'true')) {
		sendApiRes(405, 'authorization failed');
	}

	if (hasError) {
		return;
	}
	const notificationItem = request.body as INotificationItem;

	new FirebaseNotification().sendNotificationToAllUsers({ notificationItem });
	sendApiRes(200, '');
};
