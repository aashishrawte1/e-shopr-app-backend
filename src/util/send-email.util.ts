import nodeFetch from 'node-fetch';
import nodemailer, { Transporter } from 'nodemailer';
import { isProductionEnvironment, isRunningOnServer } from './check-current-environment.util';
import logger from './logger.util';

import { readFileSync } from 'fs';
import { google } from 'googleapis';
import { IUserProfile } from '../models';

let transporter: Transporter;
(async () => {
	const { OAuth2 } = google.auth;
	const credentials = JSON.parse(readFileSync('env/email-sender/email-sender-credentials.json').toString());
	const { clientId, clientSecret, redirectUrl, refreshToken } = credentials;
	const oauth2Client = new OAuth2(clientId, clientSecret, redirectUrl);

	oauth2Client.setCredentials({
		refresh_token: refreshToken,
	});

	const accessToken = await oauth2Client.getAccessToken();

	const mailConfig = {
		service: 'gmail',
		auth: {
			type: 'OAuth2',
			user: 'aashishrawte1@gmail.com', // company admin email address
			clientId,
			clientSecret,
			refreshToken,
			accessToken,
		},
	};

	transporter = nodemailer.createTransport(mailConfig as any);
	await transporter.verify();
})();
/**
 * POST /contact
 * Send a contact form via Nodemailer.
 */
export const sendEmail = async ({
	to,
	cc,
	bcc,
	message,
	subject,
	replyTo,
}: {
	to: string;
	cc?: string;
	bcc?: string;
	message: string;
	subject: string;
	replyTo?: string;
}) => {
	function replaceEmailIfRequired(email: string) {
		if (!(isProductionEnvironment() && isRunningOnServer())) {
			const whitelistedEmailForDevelopment = ['aashishrawte1@gmail.com', process.env.DEBUGGER_EMAIL];

			const emailInList = !!whitelistedEmailForDevelopment.find((wl) => wl === email.trim());
			if (emailInList) {
				return email;
			} else {
				return process.env.DEBUGGER_EMAIL || 'aashishrawte1@gmail.com';
			}
		}

		return email;
	}
	const mailOptions = {
		to: replaceEmailIfRequired(to),
		from: 'GreenDay<aashishrawte1@gmail.com>', // need to apply company email
		subject,
		html: message,
	};

	if (bcc) {
		mailOptions['bcc'] = replaceEmailIfRequired(bcc);
	}

	if (cc) {
		mailOptions['cc'] = replaceEmailIfRequired(cc);
	}
	if (replyTo) {
		mailOptions['replyTo'] = replaceEmailIfRequired(replyTo);
	}
	return new Promise((resolve, reject) => {
		transporter.sendMail(mailOptions, async (err) => {
			if (err) {
				console.error('email not sent', { mailOptions });
				reject(err);
			} else {
				console.log(`email sent to ${mailOptions.to}`);
				logger.log('info', `email sent to ${mailOptions.to}`);
				resolve(true);
			}
		});
	});
};

export const sendWelcomeEmail = async (options: IUserProfile) => {
	const userWelcomeEmailTemplateLocation =
		'https://green1sg.blob.core.windows.net/cdn/user-portal/email-templates/welcome-email-template.html';

	let welcomeEmailForUser = await (await nodeFetch(userWelcomeEmailTemplateLocation)).text();

	const { email, fullName, phone, country } = options;
	welcomeEmailForUser = welcomeEmailForUser.replace(/{{First_Name}}/g, fullName);

	// user email
	sendEmail({
		to: email,
		subject: '☘️Welcome to GreenDay!',
		message: welcomeEmailForUser,
	});

	const adminEmailTemplateLocation =
		'https://green1sg.blob.core.windows.net/cdn/user-portal/email-templates/welcome-email-template.admin.html';
	let emailToAdmin = await (await nodeFetch(adminEmailTemplateLocation)).text();

	const phoneString = `+${phone?.code || ''}-${phone?.number || ''}`;

	const whatsAppLink = `wa.me/${phone?.code || ''}${phone?.number || ''}`;
	emailToAdmin = emailToAdmin.replace(/{{First_Name}}/g, fullName);
	emailToAdmin = emailToAdmin.replace(/{{User_Email}}/g, email);
	emailToAdmin = emailToAdmin.replace(/{{User_Phone}}/g, phoneString);
	emailToAdmin = emailToAdmin.replace(/{{WhatsApp_Link}}/g, whatsAppLink);
	emailToAdmin = emailToAdmin.replace(/{{SignedUp_From_Country}}/g, country);
	sendEmail({
		to: 'aashishrawte1@gmail.com', // company admin email address
		message: emailToAdmin,
		subject: '☘️Welcome to GreenDay!',
	});
	return true;
};
