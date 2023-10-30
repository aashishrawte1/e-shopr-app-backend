export class AnalyticData {
	eventType: string;
	data: any;
	userId: string;
	deviceInfo: {
		appVersion: string;
		platform: string;
		uuid: string;
	};
	timeStamp: string;
	sessionId: string;
}
