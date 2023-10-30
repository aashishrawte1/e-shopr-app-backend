import { readFileSync, writeFileSync } from 'fs';
import { GaxiosResponse } from 'gaxios';
import { Credentials, OAuth2Client, TokenInfo } from 'google-auth-library';
import { drive_v3, google } from 'googleapis';
import { resolve } from 'path';
import readline from 'readline';

export class GoogleDriveFileDownloader {
	private static SCOPES = [
		'https://www.googleapis.com/auth/drive',
		'https://www.googleapis.com/auth/drive.readonly',
		'https://www.googleapis.com/auth/drive.file',
	];
	private static TOKEN_PATH = resolve(__dirname, `../../env/google-drive/token.json`);
	private static CREDENTIAL_PATH = resolve(__dirname, `../../env/google-drive/credentials.json`);

	private static auth: any;
	constructor() {}

	static async init() {
		const credentials = JSON.parse(
			readFileSync(GoogleDriveFileDownloader.CREDENTIAL_PATH, { encoding: 'utf-8' })
		);
		const auth = await GoogleDriveFileDownloader.authorize(credentials);
		GoogleDriveFileDownloader.auth = auth;
	}

	async downloadFile(options: drive_v3.Params$Resource$Files$Get) {
		await GoogleDriveFileDownloader.init();
		const drive = google.drive({ version: 'v3', auth: GoogleDriveFileDownloader.auth });
		const fileGetRes = await drive.files.get(options, { responseType: 'stream' });
		return fileGetRes;
	}

	static async exportFile(options: drive_v3.Params$Resource$Files$Export): Promise<GaxiosResponse<string>> {
		await GoogleDriveFileDownloader.init();
		const drive = google.drive({ version: 'v3', auth: GoogleDriveFileDownloader.auth });
		return (await drive.files.export(options, { responseType: 'text' })) as GaxiosResponse<string>;
	}

	private static async authorize(credentials: {
		installed: { client_secret: any; client_id: any; redirect_uris: any };
	}) {
		const { client_secret, client_id, redirect_uris } = credentials.installed;
		const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

		let token;
		try {
			token = JSON.parse(
				readFileSync(GoogleDriveFileDownloader.TOKEN_PATH, { encoding: 'utf-8' })
			) as Credentials;
		} catch (error) {
			console.error('No token file present');
		}
		if (!token) {
			token = await GoogleDriveFileDownloader.getAccessToken(oAuth2Client).catch((error) => {
				console.error(error);
			});
		} else {
			oAuth2Client.setCredentials({ ...token });
		}
		const accessTokenResponse = await oAuth2Client.getAccessToken();
		oAuth2Client.setCredentials({ ...token, access_token: accessTokenResponse.token });
		return oAuth2Client;
	}

	private static async getAccessToken(oAuth2Client: OAuth2Client) {
		const authUrl = oAuth2Client.generateAuthUrl({
			access_type: 'offline',
			scope: GoogleDriveFileDownloader.SCOPES,
		});

		console.log('Authorize this app by visiting this url:', authUrl);
		const rl = readline.createInterface({
			input: process.stdin,
			output: process.stdout,
		});

		return await new Promise((resolve, reject) => {
			rl.question('Enter the code from that page here: ', (code) => {
				rl.close();
				oAuth2Client.getToken(code, async (err: any, token: any) => {
					if (err) {
						reject('Error retrieving access token');
					}
					oAuth2Client.setCredentials(token);
					// Store the token to disk for later program executions
					writeFileSync(GoogleDriveFileDownloader.TOKEN_PATH, JSON.stringify(token), { encoding: 'utf-8' });
					resolve(token);
				});
			});
		});
	}
}
