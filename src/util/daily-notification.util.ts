import { format } from 'date-fns';
import { fetchAFile } from '.';
import { DayWiseNotificationListObject, INotificationItem } from '../models';
import { FirebaseNotification } from './firebase-notification.util';

export class DailyNotification {
	private notificationListRemoteUrl =
		'https://green1sg.blob.core.windows.net/cdn/user-portal/backend-assets/notification/day_wise_notification_list.json';
	async triggerNotification() {
		let currentDate = format(new Date(), 'yyyy-MM-dd');
		const notificationListFileJsonData = (await fetchAFile({
			fileUrl: this.notificationListRemoteUrl,
			fileType: 'json',
		})) as DayWiseNotificationListObject;
		const notification = notificationListFileJsonData[currentDate] as INotificationItem;
		if (!!!notification) {
			return;
		}
		const firebaseNotification = new FirebaseNotification();
		firebaseNotification.sendNotificationToAllUsers({ notificationItem: notification });
	}
}
