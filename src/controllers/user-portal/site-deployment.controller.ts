import { Request, Response } from 'express';
import { FirebaseAdmin } from '../../util';
import { sendResponse, Status } from '../../util/log-response.util';

export const getLatestSiteDeploymentInfo_API = async (request: Request, response: Response) => {
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

	const latestRelease = await FirebaseAdmin.getLatestSiteReleases();
	sendApiRes(200, '', { releaseTime: latestRelease.releaseTime });
};
