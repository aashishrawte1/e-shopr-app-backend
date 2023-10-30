import Bluebird from 'bluebird';
import { Request, Response } from 'express';
import { writeFileSync } from 'fs';
import nodeFetch from 'node-fetch';
import { getMerchantProfileDB_MP } from '.';
import { Database } from '../../database';
import { default as usersEmailList } from '../../json-data/users-email-list.json';
import { getFirstName, isProductionEnvironment, isRunningOnServer, isUserAuthenticated } from '../../util';
import { Status, sendResponse } from '../../util/log-response.util';
import { sendEmail } from '../../util/send-email.util';
nodeFetch['Promise'] = Bluebird;

// TODO: SET TO FALSE DURING PRODUCTION
const CUSTOM_EMAIL_LIST = false;
const EMAIL_SEND_PROGRESS_LIST_JSON_PATH = './temp-folder/email-send-status.json';
export const massEmailUsersAPI_MP = async (request: Request, response: Response) => {
	let hasError = false;
	function sendApiRes(code: any, description: string, result?: any) {
		const status = new Status();
		hasError = code !== 200;
		sendResponse({
			status: {
				...status,
				code,
				description,
			},
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

	const { templateUrl, subject } = request.body;
	if (!(subject && subject.trim())) {
		sendApiRes(400, 'insufficient data to process request.');
	}

	if (hasError) {
		return;
	}

	const merchant = await getMerchantProfileDB_MP({
		uid: user && user.uid,
	}).catch(async (error) => {
		console.error(
			{
				authorization: request.headers.authorization,
			},
			error
		);
		sendApiRes(405, 'authorization failed');
	});

	if (hasError) {
		return;
	}

	if (!(merchant && merchant.isAdmin)) {
		sendApiRes(403, 'You must be admin to continue...');
	}

	if (hasError) {
		return;
	}

	let userList = await Database.query.many<{
		email: string;
		fullName: string;
	}>(`
		SELECT
		u.details->'profile'->>'email' as "email",
		u.details->'profile'->>'fullName' as "fullName"
		FROM
		v1.users as u
		WHERE
		u.details->'profile'->>'email'
		NOT IN (
		SELECT email
		FROM v1.mailing_unsub_list
	)`);

	if (CUSTOM_EMAIL_LIST) {
		console.log(CUSTOM_EMAIL_LIST);
		userList = userList.filter((u) => usersEmailList.indexOf(u.email) !== -1);
	}

	if (!(isProductionEnvironment() && isRunningOnServer())) {
		console.log('using local');
		const allowedListInLocal = [process.env.DEBUGGER_EMAIL, 'aashishrawte1@gmail.com'];
		userList = userList.filter((u) => allowedListInLocal.indexOf(u.email) !== -1);
	}
	const currentEmailSendProgressList = [];

	const htmlString = await (await nodeFetch(templateUrl)).text();
	for (const user of userList) {
		const { email, fullName } = {
			email: user.email.trim(),
			fullName: user.fullName,
		};

		const firstName = getFirstName(fullName);

		const newString = htmlString.replace(/{{first_name}}/gi, firstName).replace(/{{user_email}}/gi, email);

		await sendEmail({
			to: email,
			subject: subject.trim(),
			message: newString,
		})
			.then((res) => {
				currentEmailSendProgressList.push({ ...user, success: true });
			})
			.catch((error) => {
				console.log(error);
				currentEmailSendProgressList.push({ ...user, success: false });
			});
	}

	writeFileSync(EMAIL_SEND_PROGRESS_LIST_JSON_PATH, JSON.stringify(currentEmailSendProgressList), {
		encoding: 'utf-8',
	});
	sendApiRes(200, '', null);
};
