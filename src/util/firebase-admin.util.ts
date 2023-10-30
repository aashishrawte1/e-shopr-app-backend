import * as admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { isProductionEnvironment } from './check-current-environment.util';
import { callApi } from './node-fetch.util';
export class FirebaseAdmin {
	static serviceAccount = JSON.parse(readFileSync('env/firebase-admin.json').toString());
	static admin: admin.app.App;
	static database: admin.database.Database;
	static async init() {
		FirebaseAdmin.admin = admin.initializeApp({
			credential: admin.credential.cert(this.serviceAccount),
			databaseURL: process.env.FIREBASE_REALTIME_DB,
		});
		FirebaseAdmin.database = FirebaseAdmin.admin.database();
		console.log({ database: FirebaseAdmin.database });
	}

	static getDBRef(path: string): admin.database.Reference {
		return FirebaseAdmin.database.ref(`${path}`);
	}

	static async getLatestSiteReleases() {
		const accessToken = await FirebaseAdmin.admin.options.credential.getAccessToken();
		const url = `https://content-firebasehosting.googleapis.com/v1beta1/sites/userportal-${
			isProductionEnvironment() ? 'prod' : 'uat'
		}/releases`;
		const response = await callApi({
			url,
			headers: {
				Authorization: `${(accessToken as any).token_type} ${accessToken.access_token}`,
			},
		});
		return response.releases[0];
	}
}
