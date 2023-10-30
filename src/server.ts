import { format } from 'date-fns';
import dotenv from 'dotenv';
import errorHandler from 'errorhandler';
import { resolve } from 'path';
import app from './app';
import { PAWaveSheetSync } from './controllers/user-portal/passion-wave/pa-wave-2020.controller';
import { Database } from './database';
import {
	FirebaseAdmin,
	GoogleDriveFileDownloader,
	isProductionEnvironment,
	isRunningOnServer,
	isUATEnvironment,
	startCronJobs,
} from './util';

var consoleLog = console.log;
var consoleError = console.error;

console.log = (...args: any[]) => {
	consoleLog.apply(console, [format(new Date(), 'yyyy-MM-dd hh:mm:ss')].concat(args));
};
console.error = (...args: any[]) => {
	consoleError.apply(console, [format(new Date(), 'yyyy-MM-dd hh:mm:ss')].concat(args));
};
// pm2 read config from here.
dotenv.config({ path: resolve(__dirname, './../env/.env') });
if ((isProductionEnvironment() || isUATEnvironment()) && isRunningOnServer()) {
	app.use(errorHandler());
}

console.log(process.env.DEBUGGER_EMAIL);
const server = app.listen(process.env.PORT, () => {
	// First thing after server loads is initialize Database.
	Database.init();
	FirebaseAdmin.init();
	setTimeout(() => {
		startCronJobs();
		// const pas = new PAWaveSheetSync();
		// pas.sync();
	}, 5000);

	console.log(
		`  App is running at http://localhost:${process.env.PORT} in %s mode', ${process.env.PORT} ${process.env.NODE_ENV}`
	);
	console.log('  Press CTRL-C to stop\n');
});

export default server;
