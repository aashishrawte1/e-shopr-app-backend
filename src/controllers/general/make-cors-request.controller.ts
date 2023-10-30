import { Request, Response } from 'express';
import { fetchAFile } from '../../util';
import { sendResponse, Status } from '../../util/log-response.util';
export const makeCORSRequest = async (request: Request, response: Response) => {
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

	const { url } = request.body;
	const authorization = request.headers.authorization;
	// refreshtokenuid = 15 letters
	if (
		!(
			authorization &&
			authorization.length > 14 &&
			authorization.indexOf('RefreshToken') > -1 &&
			authorization.indexOf('UID') > -1
		)
	) {
		sendApiRes(403, 'not good');
	}
	if (hasError) {
		return;
	}

	const data = await fetchAFile({ fileUrl: url, fileType: 'json' }).catch((err) => {
		sendApiRes(403, '');
	});

	if (hasError) {
		return;
	}

	sendApiRes(200, '', data);
};
