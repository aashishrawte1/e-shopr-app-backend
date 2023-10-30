import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import { isRunningOnServer } from './check-current-environment.util';

const runningOnServer = isRunningOnServer();
const dailyRotateCombined = new DailyRotateFile({
	filename: './logs/%DATE%-Combined.log',
	datePattern: 'YYYY-MM-DD-HH',
	zippedArchive: true,
	maxSize: '5mb',
	maxFiles: '14d',
	level: 'info',
});

const dailyRotateErrorLog = new DailyRotateFile({
	filename: './logs/%DATE%-Error.log',
	datePattern: 'YYYY-MM-DD-HH',
	zippedArchive: true,
	maxSize: '20m',
	maxFiles: '14d',
	level: 'error',
});

const dailyRotateDBLog = new DailyRotateFile({
	filename: './logs/%DATE%-DB-Error.log',
	datePattern: 'YYYY-MM-DD-HH',
	zippedArchive: true,
	maxSize: '20m',
	maxFiles: '14d',
	level: 'error',
});

const options: winston.LoggerOptions = {
	transports: [
		new winston.transports.Console({
			level: runningOnServer ? 'error' : 'debug',
		}),
		dailyRotateCombined,
	],
	exceptionHandlers: [dailyRotateErrorLog],
};

const logger = winston.createLogger(options);

logger.exitOnError = false;
if (!runningOnServer) {
	logger.debug('Logging initialized at debug level');
}

export const dbLogger = winston.createLogger({
	transports: [dailyRotateDBLog],
});
dbLogger.exitOnError = false;
export default logger;
