import { Request, Response } from 'express';
import { getUserCountry } from '.';
import { Database } from '../../database';
import {
	getSystemISOString,
	isUserAuthenticated,
	parseAuthorizationHeader,
	replaceSingleTickWithDoubleTick,
} from '../../util';
import { sendResponse, Status } from '../../util/log-response.util';

export const saveProductShareActivity_API = async (request: Request, response: Response) => {
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

	const user = await isUserAuthenticated({ request }).catch((err) => {
		const { code } = err;
		sendApiRes(code, 'You must be logged in to continue...');
	});
	const authorizationKeyValMap = parseAuthorizationHeader(request);
	const country = await getUserCountry({ authorizationKeyValMap });
	const userId = user && user.uid;
	const { sessionId, action, itemId, deviceInfo } = request.body;
	const dataToBeAdded = {
		userId,
		itemId,
		action,
		sessionId,
		deviceInfo,
	};

	const sql = `INSERT INTO v1.product_share_activity_tracker (
    action,
		details,
		country, 
		user_id
	) VALUES ('${action}',
	'${replaceSingleTickWithDoubleTick(JSON.stringify(dataToBeAdded))}','${getSystemISOString()}',
	'${country}', 
	'${userId}'
	)`;
	let dbRes = await Database.query.none(sql).catch((e) => {
		console.error(`DB Error: ${saveProductShareActivity_API.name}`, e);
		sendApiRes(500, 'save share failed');
	});
	if (hasError) {
		return;
	}

	sendApiRes(200, '', dbRes);
};
