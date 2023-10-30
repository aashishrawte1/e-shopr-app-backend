import { Notification } from 'firebase-admin/lib/messaging/messaging-api';

export interface INotificationResponse {
	multicast_id: string;
	success: string;
	failure: string;
	canonical_ids: string;
	results: [
		{
			message_id: string;
		}
	];
}

export interface INotificationPayload {
	to: string | number;
	collapse_key: string;
	notification: NotificationViewEntity;
	data: { customData: any };
}

export interface NotificationViewEntity {
	body: string | number;
	title: string | number;
}

export interface IDeviceResult {
	user_id: string;
	userName: string;
	userEmail: string;
	token: string;
	os: string;
	version: string;
	uuid: string;
}

export interface NotificationDataEntity {
	link: string;
	action: 'goToPage' | 'goToMarketTags' | 'filterByTags' | 'goToSearchPage' | 'dailyLoginReward';
	data?: {
		activeFilter?: ActiveFilterItem;
		searchTerm?: string;
	};
}

export interface ActiveFilterItem {
	type: 'tag' | 'merchant';
	text: string;
	selected: boolean;
	associatedTags?: string[];
	id?: string;
	avatar?: string;
}

export interface DayWiseNotificationListObject {
	[key: string]: INotificationItem;
}
export interface INotificationItem {
	notification: Notification;
	dataToSend: DataToSend;
}
export interface DataToSend {
	notificationIdentifier?: string;
	link: string;
	action: string;
	data?: Data;
}
export interface Data {
	activeFilter: ActiveFilterItem;
}

export interface NotificationTrackerFileData {
	[key: string]: boolean;
}
