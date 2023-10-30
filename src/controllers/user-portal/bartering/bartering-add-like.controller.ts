import { Request, Response } from 'express';
import { getUserCountry } from '..';
import { Database } from '../../../database';
import { INotificationItem, TShortCountryCodes } from '../../../models';
import {
	FirebaseNotification,
	getSystemISOString,
	isUserAuthenticated,
	sendResponse,
	Status,
} from '../../../util';
import { Notification } from 'firebase-admin/lib/messaging/messaging-api';

export const barteringLikeProductApi = async (request: Request, response: Response) => {
	let hasError = false;
	function sendApiRes(code: any, description: string, result?: any) {
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

	const country = await getUserCountry({ authorizationKeyValMap: user });
	const { uid } = user || {};
	const { sourceProductId, targetProductId } = request.body;

	let productLiked = false;
	const dbRes = await Database.query
		.task(async (task) => {
			const checkUserHasLikedSQL = `
			SELECT user_id as "userId" from v1.bartering_user_liked_products 
			WHERE 
			source_product_id='${sourceProductId}' AND 
			target_product_id='${targetProductId}' AND 
			country='${country}' AND 
			user_id='${uid}'`;
			productLiked = await task.oneOrNone(checkUserHasLikedSQL);

			if (!!!productLiked) {
				const likeInsertSQL = `
		INSERT INTO v1.bartering_user_liked_products 
		(user_id, source_product_id, target_product_id, liked_at, country) 
		VALUES ('${uid}', '${sourceProductId}', '${targetProductId}', '${getSystemISOString()}', '${country}')`;

				productLiked = true;
				return task.none(likeInsertSQL);
			}

			productLiked = false;

			const deleteLikedSQL = `
			DELETE FROM v1.bartering_user_liked_products WHERE 
			source_product_id='${sourceProductId}' AND 
			target_product_id='${targetProductId}'`;

			return task.none(deleteLikedSQL);
		})
		.catch((error) => {
			sendApiRes(500, 'sql failed...');
		});

	if (hasError) {
		return;
	}

	if (productLiked) {
		const getOtherUserUidSQL = `
		SELECT posted_by as "otherUserUid", 
		images->> 0 as "otherUserProductImageUrl", 
		details->'profile'->>'fullName' as "fullName", 
		title
		FROM v1.bartering_product_list bpl
		INNER JOIN v1.users u on bpl.posted_by = u.unique_id
		WHERE product_id = '${targetProductId}';
		`;
		const { otherUserProductImageUrl, otherUserUid, fullName, title } = await Database.query.one<{
			otherUserUid: string;
			otherUserProductImageUrl: string;
			fullName: string;
			title: string;
		}>(getOtherUserUidSQL);
		const notification: INotificationItem = {
			dataToSend: {
				link: `pages/bartering/product-detail?sourceProductId=${targetProductId}&targetProductId=${sourceProductId}&sourceProductImage=${otherUserProductImageUrl}`,
				action: 'goToPage',
				data: null,
			},
			notification: {
				title: `${(fullName || '').split(' ')[0]} dropped a heart ❤ on your item`,
				body: `Leave a heart ❤ for their item too `,
			} as Notification,
		};
		const firebaseNotification = new FirebaseNotification();

		firebaseNotification.sendNotificationToUsers({
			notificationItem: notification,
			userIdList: [otherUserUid],
		});
	}

	sendApiRes(200, 'liked', dbRes);
};

export const getUserLikedProduct_DB = async ({
	sourceProductId,
	targetProductId,
	uid,
	country,
}: {
	sourceProductId: string;
	targetProductId: string;
	uid: string;
	country: TShortCountryCodes;
}) => {
	const sql = `
	SELECT user_id as "userId" from v1.bartering_user_liked_products 
	WHERE 
	source_product_id='${sourceProductId}' AND 
	target_product_id='${targetProductId}' AND 
	country='${country}' AND 
	user_id='${uid}'`;

	return await Database.query.oneOrNone(sql);
};
