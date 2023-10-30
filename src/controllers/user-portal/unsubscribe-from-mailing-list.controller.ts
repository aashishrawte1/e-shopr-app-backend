import { Request, Response } from 'express';
import { Database } from '../../database';
export const unsubscribeFromMailingList_API = async (request: Request, response: Response) => {
	let hasError = false;
	function sendApiRes(code: number, description: string, result?: any) {
		hasError = code !== 200;
		response.set('Content-Type', 'text/html');
		response.send(`<h2>${description}</h2>`);
	}
	const { email } = request.query;

	if (!email) {
		sendApiRes(403, 'no email was given');
	}

	if (hasError) {
		return;
	}

	await Database.query
		.manyOrNone(
			`
	SELECT * FROM v1.users
	WHERE details->'profile'->>'email' = '${email}'
	`
		)
		.catch((_) => {
			sendApiRes(403, "are you trying to bluff our system?. Please don't do that. we are scared of you.");
		});

	if (hasError) {
		return;
	}
	await Database.query
		.one(
			`
		SELECT * from v1.mailing_unsub_list
		WHERE email = '${email}'
	`
		)
		.catch(async (error) => {
			await Database.query.none(`
			INSERT INTO
			v1.mailing_unsub_list
			(email, timestamp)
			VALUES
			('${email}', now())
			`);
		});
	sendApiRes(200, 'Unsubscribe successful');
};
