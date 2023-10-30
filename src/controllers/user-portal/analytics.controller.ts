import { Request, Response } from 'express';
import { Database } from '../../database';
import { sendResponse, Status } from '../../util/log-response.util';
import { getSystemISOString, parseAuthorizationHeader } from '../../util';
import { getUserCountry } from '.';

export const updateUserAnalyticsListApi_UP = async (request: Request, response: Response) => {
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

	if (hasError) {
		return;
	}
	const authorizationKeyValMap = parseAuthorizationHeader(request);
	const country = await getUserCountry({ authorizationKeyValMap });
	const { analyticsList: analytics } = request.body;

	try {
		if (!(analytics && analytics.length)) {
			throw 'no activity to process';
		}
	} catch (error) {
		sendApiRes(400, 'no activity to process');
	}

	if (hasError) {
		return;
	}

	await Database.query.task(async (t) => {
		try {
			if (!(analytics && analytics.length)) {
				throw 'no activity to process';
			}
			for (const analytic of analytics) {
				analytic.timeStamp = getSystemISOString();
				const insertActivitySQL = `INSERT INTO v1.analytics(user_id, country, details) 
							VALUES('${authorizationKeyValMap?.uid}','${country}','${JSON.stringify({ ...analytic })}');`;
				await t.none(insertActivitySQL);
			}
		} catch (error) {
			sendApiRes(400, 'analytical saved failed.');
		}
	});

	if (hasError) {
		return;
	}

	sendApiRes(200, 'success');
};
