import { Request, Response } from 'express';
import { getMerchantProfileDB_MP } from '.';
import { Database } from '../../database';
import { isUserAuthenticated } from '../../util';
import { sendResponse, Status } from '../../util/log-response.util';
export const getDeviceList_MP = async (request: Request, response: Response) => {
	const status = new Status();
	const user = await isUserAuthenticated({ request });
	const merchant = await getMerchantProfileDB_MP({ uid: user.uid }).catch(async (error) => {
		console.error({ authorization: request.headers.authorization }, error);
		await sendResponse({
			status: { ...status, code: 405, description: [`authorization failed`] },
			result: null,
			response,
			request,
		});
	});

	if (!(merchant && merchant.isAdmin)) {
		await sendResponse({
			status: { ...status, code: 405, description: [`authorization failed`] },
			result: null,
			response,
			request,
		});
	}

	let sql = `SELECT 
    device.token             						as "token",
    device.user_id             						as "user_id",
		device.platform								as "os",
    device.app_version 								as "version",
    device.uuid 								as "uuid",
    users.details#>>'{profile,fullName}'  as "userName",
		users.details#>>'{profile,email}'  as "userEmail" 
  FROM v1.users as users
  INNER JOIN v1.devices as device ON device.user_id = users.unique_id`;

	const dbRes = await Database.query.manyOrNone(sql).catch((e) => {
		console.error(`DB Error: ${getDeviceList_MP.name}`, e);
		status.code = 500;
	});

	await sendResponse({ status, result: dbRes, response, request });
};
