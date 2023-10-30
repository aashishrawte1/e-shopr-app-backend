import { Notification } from 'firebase-admin/lib/messaging/messaging-api';
import { getSystemISOString } from '.';
import { Database } from '../database';
import { FirebaseNotification, IUniqueNotificationMap } from './firebase-notification.util';
export class CheckoutReminderNotification {
	async triggerNotification() {
		const cartInfoSQL = `
		select * from (select
    u.user_id as "userId",
    json_array_length(cart_items :: JSON) as items_in_cart
FROM
    v1.user_shopping_cart as u
    left join v1.items_in_cart_notification_tracker as crt on u.user_id = crt.user_id
WHERE
    (
        crt.notification_sent_at < u.last_updated_at
        or crt.notification_sent_at is null
    )
    and extract(
        day
        from
            now() :: timestamp - u.last_updated_at :: timestamp
    ) > 3
    and u.user_id not in (
        select
            user_id
        from
            v1.items_in_cart_notification_tracker
    )
		and u.cart_items is not null) as ci
		WHERE ci.items_in_cart > 0;
		`;

		const cartInfo = await Database.query.manyOrNone<{
			userId: string;
			item: number;
		}>(cartInfoSQL);

		const notificationItemsMap: IUniqueNotificationMap = {};
		let insertNotificationRecordSQL = '';
		const currentTime = getSystemISOString();
		for (const cart of cartInfo) {
			const { userId, item } = cart;

			insertNotificationRecordSQL += `INSERT INTO v1.items_in_cart_notification_tracker(user_id, notification_sent_at)
						values('${userId}','${currentTime}');`;

			notificationItemsMap[userId] = {
				dataToSend: {
					link: 'pages/checkout',
					action: 'goToPage',
					data: null,
				},
				notification: {
					title: 'Items left in cart',
					body: `You have ${item} ${item <= 1 ? 'item' : 'items'} that needs your attention.`,
				} as Notification,
			};
		}
		const firebaseNotification = new FirebaseNotification();

		firebaseNotification.sendUniqueNotificationToUsers({ notificationItemsMap });

		await Database.query.none(insertNotificationRecordSQL);
		return Database.query.oneOrNone(cartInfoSQL);
	}
}
