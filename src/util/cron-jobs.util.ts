import { CronJob } from 'cron';
import {
	DailyNotification,
	CheckoutReminderNotification,
	isProductionEnvironment,
	isRunningOnServer,
} from '.';

import { PAWaveSheetSync } from '../controllers/user-portal/passion-wave/pa-wave-2020.controller';
// import { PAWaveSheetSync } from '../controllers/passion-wave/user-portal';
import { KKEventSheetSync } from '../controllers/user-portal';

export const startCronJobs = () => {
	if (!(isProductionEnvironment() && isRunningOnServer())) {
		return;
	}
	const cronConfig = {};
	// running notification login only on one server
	if (+process.env.NODE_APP_INSTANCE === 0) {
		console.log({ NODE_APP_INSTANCE: process.env.NODE_APP_INSTANCE });
		// '0 */25 * * * 6,0',
		const KKSyncCron = new CronJob(
			'0 59 17 * * *',
			() => {
				const pas = new PAWaveSheetSync();
				console.log('firing KK Sync function at ', new Date().toString());
				pas.sync();
				// const KKSync = new KKEventSheetSync();
				// KKSync.sync();
			},
			null,
			false,
			'Asia/Singapore'
		);
		console.log('starting KK-sync cron');
		KKSyncCron.start();
	}

	if (+process.env.NODE_APP_INSTANCE === 1) {
		console.log({ NODE_APP_INSTANCE: process.env.NODE_APP_INSTANCE });

		const morningCron = new CronJob(
			'0 59 7 * * *',
			() => {
				const dailyNotification = new DailyNotification();
				console.log('firing Daily Morning notification ', new Date().toString());
				dailyNotification.triggerNotification();
			},
			null,
			false,
			'Asia/Singapore'
		);
		morningCron.start();
		console.log('starting Daily Morning Notification cron');

		const checkoutCron = new CronJob(
			`0 59 10 * * *`,
			() => {
				const checkoutNotification = new CheckoutReminderNotification();
				console.log('firing checkoutNotification ', new Date().toString());
				checkoutNotification.triggerNotification();
			},
			null,
			false,
			'Asia/Singapore'
		);
		checkoutCron.start();
		console.log('starting Checkout Cron');
	}
};
