import { Request, Response } from 'express';
import { Database } from '../../../database';
import { IBarteringMessage, INotificationItem } from '../../../models';
import {
	FirebaseAdmin,
	FirebaseNotification,
	getFirstName,
	getSystemISOString,
	isUserAuthenticated,
	sendResponse,
	Status,
} from '../../../util';
import { Notification } from 'firebase-admin/lib/messaging/messaging-api';

const barteringRootPath = 'barteringChat';
const barteringChatPaths = {
	messages: `${barteringRootPath}/messages`,
	chatRooms: `${barteringRootPath}/chatRooms`,
};
export const barteringPostMessageApi = async (request: Request, response: Response) => {
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

	const { productIds = [], message } = request.body;
	if (!(productIds.length > 1)) {
		sendApiRes(403, 'forbidden');
		return;
	}
	const key = productIds.sort().join('__');
	const sql = `
	SELECT 
	bpl.posted_by as "userId", 
	bpl.title as title,
	bpl.product_id as "productId",
	bpl.images->0 as "mainImage", 
	usr.details->'profile'->>'fullName' AS "fullName",
	COALESCE(usr.details->'profile'->>'avatarUrl', '') AS "avatarUrl"
	FROM 
	v1.bartering_product_list bpl
	INNER JOIN v1.users usr ON bpl.posted_by = usr.unique_id
	WHERE product_id IN (${productIds.map((id: string) => `'${id}'`).join(',')})
	`;
	const productList = await Database.query.many(sql);
	const membersMap = {};
	const productsInfo = {};
	for (const p of productList) {
		membersMap[`${p.userId}`] = {
			uid: p.userId,
			name: getFirstName(p.fullName),
			avatarUrl: p.avatarUrl,
		};
		productsInfo[`${p.productId}`] = {
			title: p.title,
			image: p.mainImage,
		};
	}

	const messageFullInfo: IBarteringMessage = {
		author: { uid, name: membersMap[uid].name },
		message,
		time: getSystemISOString(),
	};

	const chatRoomInfo = {
		members: membersMap,
		lastMessage: messageFullInfo,
		productsInfo,
		barteringLevel: productIds.length,
	};

	FirebaseAdmin.getDBRef(`${barteringChatPaths.chatRooms}/${key}`).update(chatRoomInfo);
	FirebaseAdmin.getDBRef(`${barteringChatPaths.messages}/${key}`).push(messageFullInfo);

	const productsFromOtherUser = productList.filter((p) => p.userId !== uid);
	const firebaseNotification = new FirebaseNotification();
	const notificationItem: INotificationItem = {
		dataToSend: {
			link: `pages/bartering/chat-room-messages?productIds=${productIds.sort().join(',')}`,
			action: 'goToPage',
			data: null,
		},
		notification: {
			body: `${messageFullInfo.message}`,
			title: `${messageFullInfo.author.name}`,
		} as Notification,
	};

	// send notification to all the other users involved in it.
	firebaseNotification.sendNotificationToUsers({
		userIdList: productsFromOtherUser.map((p) => p.userId),
		notificationItem,
	});
	sendApiRes(200, '');
};
