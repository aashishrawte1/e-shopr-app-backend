import { formatToTimeZone } from 'date-fns-timezone';
export const getSystemISOString = (): string => {
	return new Date().toISOString();
};

export const getFormattedTimeForTimeZone = (options?: {
	timeFormatStr: string;
	timeZoneString: string;
	dateToFormat: string;
}): string => {
	const {
		timeFormatStr = 'DD MMMM YYYY HH:mm aa [GMT](z)',
		timeZoneString = 'Asia/Singapore',
		dateToFormat = new Date().toISOString(),
	} = options || {};
	return formatToTimeZone(dateToFormat, timeFormatStr, {
		timeZone: timeZoneString,
	});
};
