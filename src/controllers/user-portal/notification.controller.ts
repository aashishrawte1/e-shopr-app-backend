import { Request, Response } from 'express';
import { Database } from '../../database';
import { sendResponse, Status } from '../../util/log-response.util';

export const updateNotificationStatusAPI = async (request: Request, response: Response) => {
	const status = new Status();
	const { uniqueMessageId, openMode = 'tappedOnNotificationToOpenIt' } = request.body as {
		uniqueMessageId: string;
		openMode: 'receivedWhileAppWasOpen' | 'tappedOnNotificationToOpenIt';
	};
	const sql = `
	UPDATE 
	v1.notification_status_log 
	SET success=true,
	${
		openMode === 'receivedWhileAppWasOpen'
			? 'received_while_app_open=true,received_on=now()'
			: 'notification_open_time=now()'
	} 
	WHERE unique_message_id='${uniqueMessageId}'`;
	await Database.query.none(sql).catch((e) => {
		console.error(`DB Error: ${updateNotificationStatusAPI.name}`, e);
	});

	sendResponse({ status, result: null, response, request });
};
