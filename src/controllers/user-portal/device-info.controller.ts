import { Request, Response } from 'express';
import { Database } from '../../database';
import { getSystemISOString, parseAuthorizationHeader } from '../../util';
import { sendResponse, Status } from '../../util/log-response.util';

export const saveDeviceInfo_API = async (request: Request, response: Response) => {
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

	const user = parseAuthorizationHeader(request);
	const { token, deviceInfo } = request.body;
	let { uuid, platform, appVersion, operatingSystem } = deviceInfo;

	platform = (platform || '').toLowerCase();
	if (!platform) {
		platform = operatingSystem; // fallback value
	}
	if (platform === 'mac') {
		// for iPads
		platform = 'ios';
	}

	let sql: string;

	// This api will simply update device info if present. When user login happens, this event is fired.

	if (!(platform === 'android' || platform === 'ios')) {
		sendApiRes(
			403,
			`operating system is invalid. data: ${JSON.stringify({
				operatingSystem: platform,
				token,
				uuid,
			})}`
		);
	}

	if (hasError) {
		return;
	}

	const { uid: userId } = user || {};

	await Database.query.task(async (t) => {
		const result = await t.oneOrNone(`SELECT token FROM v1.devices WHERE uuid='${uuid}'`).catch((_) => {
			console.error('more than one similar uuid was present.');
			sendApiRes(500, 'same uuid found more than once.');
		});
		if (hasError) {
			return;
		}

		if (!result) {
			sql = `
			INSERT INTO v1.devices(token, user_id, platform, uuid, app_version, updated_at)
			VALUES('${token || null}','${userId || null}','${platform}','${uuid}', '${
				appVersion || null
			}', '${getSystemISOString()}')`;
		} else {
			sql = `
			UPDATE v1.devices 
			SET 
			updated_at = '${getSystemISOString()}' `;

			if (appVersion) {
				sql += `, app_version='${appVersion}'`;
			}
			if (token) {
				sql += `, token='${token}'`;
			}
			if (userId) {
				sql += `, user_id='${userId}'`;
			}

			sql += ` where uuid='${uuid}'`;
		}
		await t.none(sql);
	});

	if (hasError) {
		return;
	}

	sendApiRes(200, 'success');
};
