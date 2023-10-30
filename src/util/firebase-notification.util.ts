import FCM from 'fcm-node';
import { promisify } from 'util';
import { sendEmail } from '.';
import { Database } from '../database';
import { INotificationItem, INotificationPayload } from '../models';
import { replaceSingleTickWithDoubleTick } from './string-manipulation.util';
import { nanoid } from 'nanoid';
import { format } from 'date-fns';
type TPlatformTypes = 'ios' | 'android';
interface IDevice {
	token: string;
	tokenUpdatedAt: string;
	fullName: string;
	userId: string;
	uuid: string;
	platform: TPlatformTypes;
}
interface IFCMSendNotificationResponse {
	token: string;
	success: boolean;
	uniqueMessageId: string;
}

export interface IUniqueNotificationMap {
	[key: string]: INotificationItem;
}
export class FirebaseNotification {
	private fcm = new FCM(process.env.FCM_SERVER_KEY);

	sendNotificationToUsers = async ({
		userIdList,
		notificationItem,
	}: {
		userIdList: Array<string>;
		notificationItem: INotificationItem;
	}) => {
		let deviceList: Array<IDevice> | void = await this.getDeviceNotificationTokens({
			allUsers: false,
			userIdList,
		}).catch((e) => {
			console.error(`DB Error: ${this.sendNotificationToAllUsers.name}`, e);
		});

		if (!deviceList) {
			return;
		}

		this.sendNotificationToDevices({ notificationItem, deviceList });
	};

	sendNotificationToAllUsers = async ({ notificationItem }: { notificationItem: INotificationItem }) => {
		let deviceList: Array<IDevice> | void = await this.getDeviceNotificationTokens({ allUsers: true }).catch(
			(e) => {
				console.error(`DB Error: ${this.sendNotificationToAllUsers.name}`, e);
			}
		);

		if (!deviceList) {
			return;
		}

		const getStrDate = (date: Date) => format(date, 'yyyy-MM-dd');
		const getNotificationIdentifier = (dateStr: string) => `${dateStr}-daily-notification`;

		const date = new Date();
		let currentDateStr = getStrDate(date);
		const currentDateNotificationIdentifier = getNotificationIdentifier(currentDateStr);

		notificationItem.dataToSend.notificationIdentifier = currentDateNotificationIdentifier;
		const response = await this.sendNotificationToDevices({ notificationItem, deviceList });
		const sentNotificationContentTrackerInsertSQL = `
		INSERT INTO v1.sent_notification_content_tracker(
		notification_identifier, details)
		VALUES ('${currentDateNotificationIdentifier}', '${replaceSingleTickWithDoubleTick(
			JSON.stringify(notificationItem)
		)}');
		`;
		await Database.query.none(sentNotificationContentTrackerInsertSQL).catch((err) => {
			console.error('same notification identifier cant be inserted again');
		});
		const tokenMap: { [key: string]: IDevice } = {};
		for (const device of deviceList) {
			tokenMap[`${device.token}`] = device;
		}
		let sql = `
		INSERT INTO v1.notification_status_log (
	 		notification_identifier, device_uuid, user_id, sent_at, received_on, success, received_while_app_open, notification_open_time, notification_token, unique_message_id, platform)
			VALUES 
		`;
		const allResponses = [...response.failureList, ...response.successList];
		for (const [index, res] of Object.entries(allResponses)) {
			sql += ` 
			('${currentDateNotificationIdentifier}', '${tokenMap[res.token].uuid}', '${
				tokenMap[res.token].userId
			}', now(), null, '${res.success}', null, null, '${res.token}', '${res.uniqueMessageId}', '${
				tokenMap[res.token].platform
			}') ${+index === allResponses.length - 1 ? '' : ','} 
			`;
		}

		// INSERT INTO v1.notification_status_log VALUES

		if ((response.failureList || []).length > 0) {
			sql += `
			DELETE FROM v1.devices WHERE
			token = '(
			${response.failureList.map((res) => `'${res.token}'`).join(',')}
			)';
			`;
		}
		if (sql) {
			// insert all data
			await Database.query.none(sql).catch((err) => {
				console.error(err, 'insert failed for latest notifications sent');
			});
		}

		//PREVIOUS REPORT generation
		const previousDate = new Date();
		previousDate.setDate(previousDate.getDate() - 1);
		const previousDateStr = getStrDate(previousDate);
		const previousDateNotificationIdentifier = getNotificationIdentifier(previousDateStr);
		const previousDateSelectSQL = `
		SELECT
			row_id,
			notification_identifier,
			device_uuid,
			user_id,
			sent_at,
			received_on,
			success,
			received_while_app_open,
			notification_open_time, 
			notification_token, 
			platform
		FROM
		v1.notification_status_log
		WHERE notification_identifier = '${previousDateNotificationIdentifier}'
		;
		`;
		const previousDayNotificationRecords = await Database.query.manyOrNone<{
			row_id: number;
			notification_identifier: string;
			device_uuid: string;
			user_id: string;
			sent_at: string;
			received_on: string;
			success: boolean;
			received_while_app_open: boolean;
			notification_open_time: string;
			notification_token: string;
			platform: TPlatformTypes;
		}>(previousDateSelectSQL);

		if (previousDayNotificationRecords.length === 0) {
			return;
		}

		const uniqueUsers = {};
		const uniqueDevices = {};
		const platformCount = {
			ios: 0,
			android: 0,
		};
		const status = {
			failure: 0,
			success: 0,
		};
		const receivedStatus = {
			whileOpen: 0,
			tapped: 0,
		};
		for (const record of previousDayNotificationRecords) {
			uniqueUsers[`${record.user_id}`] = true;
			uniqueDevices[`${record.notification_token}`] = true;
			// platform count
			if (record.platform === 'android') {
				platformCount.android += 1;
			} else {
				platformCount.ios += 1;
			}

			// sent status count
			if (record.success === true) {
				status.success += 1;
			} else {
				status.failure += 1;
			}

			if (record.received_while_app_open === true) {
				receivedStatus.whileOpen += 1;
			} else if (record.notification_open_time) {
				receivedStatus.tapped += 1;
			}
		}
		const totalNumberOfUsers = Object.keys(uniqueUsers).length;
		const totalDevices = Object.keys(uniqueDevices).length;
		const totalIos = platformCount.ios;
		const totalAndroid = platformCount.android;
		const totalSuccess = status.success;
		const totalFailure = status.failure;
		const numberOfNotificationOpens = receivedStatus.tapped;
		const numberOfNotificationsReceivedWhileAppOpen = receivedStatus.whileOpen;
		const previousDayNotificationContentSQL = `
		SELECT notification_identifier, details
		FROM v1.sent_notification_content_tracker;
		`;
		const notificationContent = await Database.query.one<{
			notification_identifier: string;
			details: INotificationItem;
		}>(previousDayNotificationContentSQL);

		const dataToSendInEmail = {
			totalNumberOfUsers,
			totalDevices,
			ios: totalIos,
			android: totalAndroid,
			successCount: totalSuccess,
			failureCount: totalFailure,
			opens: numberOfNotificationOpens,
			receivedWhenAppWasOpen: numberOfNotificationsReceivedWhileAppOpen,
			notificationContent,
		};

		sendEmail({
			to: process.env.DEBUGGER_EMAIL,
			message: JSON.stringify(dataToSendInEmail, null, 2),
			subject: 'previous_day_notification_statistics',
		});
	};

	// trashed //

	async sendUniqueNotificationToUsers({
		notificationItemsMap,
	}: {
		notificationItemsMap: IUniqueNotificationMap;
	}) {
		const userIdList = Object.keys(notificationItemsMap);
		let allDeviceList: Array<IDevice> | void = await this.getDeviceNotificationTokens({
			allUsers: false,
			userIdList,
		}).catch((e) => {
			console.error(`DB Error: ${this.sendNotificationToAllUsers.name}`, e);
		});

		if (!allDeviceList) {
			return;
		}

		const notificationMap: {
			[key: string]: {
				deviceList: Array<IDevice>;
				notificationItem: INotificationItem;
			};
		} = {};

		for (const device of allDeviceList) {
			notificationMap[device.userId] = notificationMap[device.userId] || ({} as any);
			notificationMap[device.userId].notificationItem = notificationItemsMap[device.userId];
			notificationMap[device.userId].deviceList = notificationMap[device.userId].deviceList || [];
			notificationMap[device.userId].deviceList.push(device);
		}

		for (const [key, value] of Object.entries(notificationMap)) {
			this.sendNotificationToDevices({
				notificationItem: value.notificationItem,
				deviceList: value.deviceList,
			});
		}
	}

	private async getDeviceNotificationTokens({
		allUsers,
		userIdList,
	}: {
		allUsers?: boolean;
		userIdList?: Array<string>;
	}) {
		return await Database.query.manyOrNone(this.getDeviceNotificationTokenSQL({ allUsers, userIdList }));
	}

	private async sendNotificationToDevices({
		notificationItem,
		deviceList,
	}: {
		notificationItem: INotificationItem;
		deviceList: Array<IDevice>;
	}) {
		const payload: Partial<INotificationPayload> = {
			collapse_key: 'type_a',
			// notification: notificationItem?.notification,
			data: { customData: notificationItem?.dataToSend },
		};

		const notificationPromises = [];

		const fcmPromise = promisify(this.fcm.send).bind(this.fcm);

		const getUniqueMessageId = (salt: string) => `${nanoid()}_${salt}`;
		for (const [index, deviceData] of Object.entries(deviceList)) {
			payload.to = deviceData.token;
			payload.data.customData = payload.data.customData || {};
			payload.data.customData.uniqueMessageId = getUniqueMessageId(index);

			const dataToReturn = {
				token: deviceData.token,
				uniqueMessageId: payload.data.customData.uniqueMessageId,
			};
			notificationPromises.push(
				fcmPromise(payload)
					.then((_: any) => ({
						...dataToReturn,
						success: true,
					}))
					.catch((_: any) => ({
						...dataToReturn,
						success: false,
					}))
			);
		}

		const resolves = (await Promise.allSettled(notificationPromises)) as unknown as Array<{
			status: string;
			value: IFCMSendNotificationResponse;
		}>;
		const responseToSend: {
			successList: Array<IFCMSendNotificationResponse>;
			failureList: Array<IFCMSendNotificationResponse>;
		} = {
			successList: [],
			failureList: [],
		};

		for (const res of resolves) {
			if (res.value.success === true) {
				responseToSend.successList.push(res.value);
				continue;
			}
			responseToSend.failureList.push(res.value);
		}

		return responseToSend;
	}

	private getDeviceNotificationTokenSQL({
		allUsers,
		userIdList,
	}: {
		allUsers?: boolean;
		userIdList?: Array<string>;
	}) {
		let sql = `
		SELECT u.details->'profile'->>'fullName' as "fullName",
						token,
            row_number() over (
                partition by token
                order by DATE(updated_at) desc
            ) as rownum,
            DATE(updated_at) as "tokenUpdatedAt",
            user_id as "userId",
						uuid, 
						platform
        FROM v1.devices d
            LEFT JOIN v1.users u ON d.user_id = u.unique_id
        WHERE NOT (
                token is null
                OR token = 'null'
						)
		`;
		if (!allUsers) {
			if (!userIdList) {
				return;
			}
			sql += `AND user_id in (${userIdList.map((i) => `'${i}'`).join(',')})`;
		}

		return sql;
	}
}
