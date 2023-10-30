import { Request, Response } from 'express';
import { getUserProfileDB_UP } from '.';
import { Database } from '../../database';

import { isUserAuthenticated, fetchAFile } from '../../util';
import { sendResponse, Status } from '../../util/log-response.util';
import { getSQLQueryForProductsWithOptions } from './get-products-based-on-query';
import { sendEmail } from '../../util/send-email.util';
import { IProductResult } from '../../models';

export const sendEmailForGreenConciergeChat_API = async (request: Request, response: Response) => {
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

	const authorizationKeyValMap = await isUserAuthenticated({ request }).catch((err) => {
		const { code, error } = err;
		sendApiRes(code, 'You must be logged in to continue...');
	});

	if (hasError) {
		return;
	}

	const { uid } = authorizationKeyValMap || {};
	const { chatType, productId, message } = request.body as {
		chatType: 'greenday_initiated_product_query_message' | 'green_concierge_user_message';
		productId: string;
		message: string;
	};

	// get product image, id, title, merchant name, user name
	const templateUrlMap = {
		greenday_initiated_product_query_message:
			'https://green1sg.blob.core.windows.net/cdn/user-portal/email-templates/green-concierge-email-templates/greenday_initiated_product_query_message.html',
		green_concierge_user_message:
			'https://green1sg.blob.core.windows.net/cdn/user-portal/email-templates/green-concierge-email-templates/green_concierge_user_message.html',
		registration_welcome_message:
			'https://green1sg.blob.core.windows.net/cdn/user-portal/email-templates/green-concierge-email-templates/green_concierge_user_message.html',
	};

	if (!(chatType in templateUrlMap)) {
		sendApiRes(500, 'wrong params');
	}
	if (hasError) {
		return;
	}

	const userDetails = await getUserProfileDB_UP({ userId: uid });

	let htmlString = await fetchAFile({
		fileUrl: `${templateUrlMap[chatType]}?hash=${+new Date()}`,
		fileType: 'text',
	});

	htmlString = htmlString.replace(/{{request_type}}/gi, chatType);
	let subject = 'GreenDay - Green_Concierge chat';
	if (chatType === 'greenday_initiated_product_query_message') {
		const product = await Database.query.one<IProductResult>(
			getSQLQueryForProductsWithOptions({
				start: 0,
				end: 10,
				sorting: undefined,
				filters: { idList: [productId] },
				country: userDetails.country,
			})
		);
		htmlString = htmlString
			.replace(/{{product_image}}/gi, product.media[0].link)
			.replace(/{{product_id}}/gi, product.uniqueId)
			.replace(/{{product_title}}/gi, product.title)
			.replace(/{{merchant_name}}/gi, product.ownerName)
			.replace(/{{user_name}}/gi, userDetails.fullName)
			.replace(/{{user_email}}/gi, userDetails.email);
	} else if (chatType === 'green_concierge_user_message') {
		htmlString = htmlString
			.replace(/{{user_name}}/gi, userDetails.fullName)
			.replace(/{{user_email}}/gi, userDetails.email)
			.replace(/{{user_message}}/gi, message);
	} else if (chatType === 'registration_welcome_message') {
		subject = 'New User Registration';
		htmlString = htmlString
			.replace(/{{user_name}}/gi, userDetails.fullName)
			.replace(/{{user_email}}/gi, userDetails.email)
			.replace(/{{user_message}}/gi, message);
	} else {
		sendApiRes(500, 'query not recognized');
	}

	sendEmail({
		to: `admin+${chatType}@grendayapp.com`,
		replyTo: userDetails.email,
		subject,
		message: htmlString,
	});

	if (hasError) {
		return;
	}
	sendApiRes(200, '');
};
