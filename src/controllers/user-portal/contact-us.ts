import { Request, Response } from 'express';

import { Database } from '../../database';
import { getSystemISOString } from '../../util';
import { sendResponse, Status } from '../../util/log-response.util';
import { sendEmail } from '../../util/send-email.util';

export const contactUsApi_UP = async (request: Request, response: Response) => {
	const status = new Status();

	const { messageData, messageOrigin } = request.body;
	const { email, message, name } = messageData;
	const emailPromises = [];

	emailPromises.push(
		sendEmail({
			to: `admin+${messageOrigin}@grendayapp.com`,
			message: `<blockquote>Message <br>${message}</blockquote>`,
			subject: message.toLowerCase().includes('uzair')
				? `New user registration`
				: `User Query-${message.substring(0, 40)}`,
			replyTo: `${name}<${email}>`,
			bcc: 'admin@grendayapp.com',
		})
	);

	if (messageOrigin === 'contact-us') {
		emailPromises.push(
			sendEmail({
				to: email,
				subject: 'Thank you for writing to us',
				bcc: '',
				message: `
				
				<p>Dear ${name}, </p><br> 
				<p>Thanks for reaching out! This is to inform you we have received your request. </p> 
				<p>While we try to reply to everyone as soon as possible sometimes it take 1 - 3 days. Be rest assured though, we will get back to you.  </p><br>
				<p>Alternatively, contact our team directly using Green Concierge option within the app.</p><br>
				<blockquote>You wrote <br>${message}</blockquote>
				<p>Have a great day!</p><br>
				<p>Thanks, <br>GreenDay Team</p> 
				`,
			})
		);
	}

	Promise.resolve(emailPromises).catch((e) => {
		console.error(`Send Email Error: ${contactUsApi_UP.name}`, e);
		status.code = 500;
	});

	const sql = `INSERT INTO v1.sent_email_record (
		unique_id,
		details,
		posted_at
	) VALUES (v1.id_generator(), '${JSON.stringify(request.body).replace(
		/'/g,
		"''"
	)}','${getSystemISOString()}')`;

	const dbRes = await Database.query.none(sql).catch((e) => {
		console.error(`DB Error: ${contactUsApi_UP.name}`, e);
		status.code = 500;
	});

	sendResponse({ status, result: dbRes, response, request });
};
