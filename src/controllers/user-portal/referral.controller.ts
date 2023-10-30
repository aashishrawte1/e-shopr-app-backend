import { Request, Response } from 'express';
import { Database } from '../../database';
import { INotificationItem } from '../../models';
import { isUserAuthenticated } from '../../util';
import { sendResponse, Status } from '../../util/log-response.util';
import { FirebaseNotification } from './../../util/firebase-notification.util';
import { getUserProfileDB_UP } from './user.controller';
import { Notification } from 'firebase-admin/lib/messaging/messaging-api';
export const getReferralCodeApi_UP = async (request: Request, response: Response) => {
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

	const user = await isUserAuthenticated({ request }).catch((err) => {
		const { code, error } = err;
		sendApiRes(code, 'You must be logged in to continue...');
	});

	if (hasError) {
		return;
	}

	const { uid } = user || {};
	let dbRes;
	const sql = `select referral_code as "referralCode" from v1.referral_code where unique_id='${uid}'`;
	dbRes = await Database.query.one(sql).catch((e) => {
		sendApiRes(500, 'no referral_code found');
	});

	if (hasError) {
		return;
	}
	sendApiRes(200, '', dbRes);
};

export const checkReferralCodeValidity_API = async (request: Request, response: Response) => {
	const status = new Status();
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

	await isUserAuthenticated({ request }).catch((err) => {
		const { code, error } = err;
		sendApiRes(code, 'You must be logged in to continue...');
	});

	if (hasError) {
		return;
	}

	const { referralCode } = request.body;

	let dbRes;

	const sql = `select referral_code as "referralCode" from v1.referral_code where referral_code='${referralCode}'`;
	dbRes = await Database.query.one(sql).catch((e) => {
		sendApiRes(403, 'Invalid referral code. Make sure you type it correctly.');
	});

	sendResponse({ status, result: dbRes, response, request });
};

export const getReferrerUniqueId = async ({ referralCode }: { referralCode: string }) => {
	const sql = `select unique_id as "uniqueId" from v1.referral_code where referral_code='${referralCode}'`;
	return await Database.query.oneOrNone(sql);
};

export const getReferrerNotificationDetailApi_UP = async (request: Request, response: Response) => {
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

	const user = await isUserAuthenticated({ request }).catch((err) => {
		const { code, error } = err;
		sendApiRes(code, 'You must be logged in to continue...');
	});

	if (hasError) {
		return;
	}
	const { referralCode } = request.query;
	let dbRes: void | any[];
	const sql = `select unique_id as "uniqueId",token 
from v1.devices as device
INNER JOIN v1.referral_code as c ON c.unique_id = device.user_id where c.referral_code='${referralCode}'`;
	dbRes = await Database.query.manyOrNone(sql).catch((e) => {
		sendApiRes(500, 'no referral_code found');
	});

	if (hasError) {
		return;
	}
	sendApiRes(200, '', dbRes);
};

export const rewardAppReferrer = async ({
	referralCode,
	rewardClaimerUid,
	referrerUserUid,
}: {
	referralCode: string;
	rewardClaimerUid: string;
	referrerUserUid: string;
}) => {
	const firebaseNotification = new FirebaseNotification();
	const rewardClaimerUserProfile = await getUserProfileDB_UP({ userId: rewardClaimerUid });
	const notificationItem: INotificationItem = {
		dataToSend: {
			link: 'pages/profile',
			action: 'goToPage',
			data: null,
		},
		notification: {
			body: `You have been awarded 10,000 gems for a successful referral of ${rewardClaimerUserProfile.fullName}!`,
			title: `${rewardClaimerUserProfile.fullName} joined GreenDay`,
		} as Notification,
	};

	await firebaseNotification.sendNotificationToUsers({ notificationItem, userIdList: [referrerUserUid] });
	return true;
};
