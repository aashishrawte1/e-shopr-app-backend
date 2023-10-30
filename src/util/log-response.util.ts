import { Response, Request } from 'express';
import logger from './logger.util';
import { format } from 'date-fns';
import { userEndpoints } from '../app.routes';

export class Status {
	code: number = 200;
	description?: any = [];
}

export class ApiResponse {
	status = new Status();
	result = {} as any;
}

const logRequest = (request: Request, response: Response, data: ApiResponse) => {
	const logResponseBodyForPaths = [userEndpoints.makePayment, userEndpoints.saveOrder];

	const shouldLogBody = !!logResponseBodyForPaths.find((l) => request.url.includes(l));
	const methodType = response.req.method.toUpperCase();
	if (methodType === 'GET' || methodType === 'POST') {
		const toLog = {
			timestamp: format(new Date(), 'yyyy-mm-dd-hh mm:ss'),
			ip: request.ip,
			sessionId: request.sessionID,
			url: request.path,
		};

		if (shouldLogBody) {
			toLog['res'] = data;
		}
		if (data.status.code !== 200) {
			logger.error('error', JSON.stringify(toLog));
		} else {
			logger.log('info', JSON.stringify(toLog));
		}
	}
};

export const createResponse = (status: Status, result?: any) => {
	const response = new ApiResponse();
	response.status = status;
	response.result = result;
	return response;
};

export const sendResponse = ({
	status,
	result,
	response,
	request,
}: {
	status: Status;
	result: any;
	request: Request;
	response: Response;
}) => {
	const data = createResponse(status, result);
	logRequest(request, response, data);
	response.send(data).end();
};
