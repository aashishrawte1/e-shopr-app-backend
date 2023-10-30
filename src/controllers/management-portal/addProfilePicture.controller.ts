import { Status, sendResponse } from '../../util/log-response.util';
import { isUserAuthenticated } from '../../util';
import { Database } from '../../database';
import { Request, Response } from 'express';
import { getMerchantProfileDB_MP } from '.';

export const addProfilePictureApi_MP = async (request: Request, response: Response) => {
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
		const { code, error } = err;
		sendApiRes(code, 'You must be logged in to continue...');
	});

	if (hasError) {
		return;
	}

	await getMerchantProfileDB_MP({ uid: user && user.uid }).catch(async (error) => {
		console.error({ authorization: request.headers.authorization }, error);
		sendApiRes(400, 'You must be logged in to continue...');
	});

	if (hasError) {
		return;
	}

	const { avatar } = request.body;

	const sql = `UPDATE v1.merchant
		SET details = jsonb_set(details, '{profile,avatarUrl}', '"${avatar.link}"', True)
		WHERE unique_id = '${user && user.uid}'`;

	const dbRes = await Database.query.none(sql).catch((e) => {
		console.error(`DB Error: ${addProfilePictureApi_MP.name}`, e);
		sendApiRes(400, 'error');
	});

	if (hasError) {
		return;
	}
	sendApiRes(200, '', dbRes);
};
