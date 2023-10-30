import { createWriteStream, writeFileSync } from 'fs';
import { resolve } from 'path';
import {
	getNumberOfCoinsThatCanBeRewarded,
	getSQLForAddingCoinActivityToDB,
	getUserCoinsFromDB,
	getWalletUpdateSQL,
} from '.';
import { Database } from '../../database';
import { TShortCountryCodes, UserCoinActivity } from '../../models';
import {
	getSystemISOString,
	GoogleDriveFileDownloader,
	isProductionEnvironment,
	isRunningOnServer,
	isUserAuthenticated,
	parseCSVToJSONFromFile,
	sendEmail,
	sendResponse,
	Status,
} from '../../util';
import { Request, Response } from 'express';
import { CronJob } from 'cron';
interface IPAWaveCSVData {
	Timestamp: string;
	'Enter User Email (Please ensure its the same email as the one used for registering on GreenDay)': string;
	'Enter District': string;
	'Enter Weight (kg)': number;
}

interface IRewardInfo {
	email: string;
	weight: number;
	district: string;
	lastUpdatedTime: string;
}

interface IRewardUserRecordMap {
	[key: string]: IRewardInfo;
}

export class PAWaveSheetSync {
	async sync() {
		console.log('STARTING SYNC OF PA SHEET');
		const country: TShortCountryCodes = 'sg';
		const paWaveFormResponseSheetId = '19SBpbLbDhXz2hRsRwWmo9UoLkQYO1gb_S_tnbbHmbYQ';

		const fileResponse = await GoogleDriveFileDownloader.exportFile({
			fileId: paWaveFormResponseSheetId,
			mimeType: 'text/csv',
		});

		const csvFileLocation = resolve(__dirname, '../../json-data/pa-wave.csv');
		writeFileSync(csvFileLocation, fileResponse.data);
		const data = (await parseCSVToJSONFromFile({ fileLocation: csvFileLocation })) as IPAWaveCSVData[];

		const usersToReward: IRewardUserRecordMap = {};
		const emailWithDistrictTracker: { [key: string]: boolean } = {};

		const errors: {
			[key: string]: {
				email: string;
				errorMessage: string;
			};
		} = {};

		const findKeyThatStartsWith = (matchingKeyToFind: string) => {
			return Object.keys(emailWithDistrictTracker).find((f) => f.startsWith(matchingKeyToFind));
		};
		for (const d of data) {
			const email =
				d[
					'Enter User Email (Please ensure its the same email as the one used for registering on GreenDay)'
				].toLowerCase();
			const district = d['Enter District'].toLowerCase();
			const weight = +d['Enter Weight (kg)'];

			const emailWithDistrictKey = `${email}-${district}`;
			const matchingKey = findKeyThatStartsWith(email);
			if (!!matchingKey) {
				if (emailWithDistrictKey in emailWithDistrictTracker) {
					// then add the values
					usersToReward[email].weight = usersToReward[email].weight + weight;
				} else {
					// this is error. because if the user is already present, then district should have matched already.
					errors[email] = {
						email,
						errorMessage: `User with ${email} has different districts ${matchingKey.split(email)[1]}, ${
							emailWithDistrictKey.split(email)[1]
						}`,
					};
					delete usersToReward[email];
				}
			} else {
				emailWithDistrictTracker[emailWithDistrictKey] = true;
				usersToReward[email] = {
					email,
					district,
					lastUpdatedTime: getSystemISOString(),
					weight,
				};
			}
		}

		let sql = `
    SELECT  
    email, district, total_weight_collected, 
    last_updated_at
	  FROM v1.pa_wave_pwoc_season_2020;
    `;
		const dbUserRecords = await Database.query.manyOrNone<{
			email: string;
			district: string;
			total_weight_collected: string;
			last_updated_at: string;
		}>(sql);

		const dbUserRecordMap: IRewardUserRecordMap = {};
		if (!!dbUserRecords.length) {
			for (const userRecord of dbUserRecords) {
				dbUserRecordMap[userRecord.email] = {
					district: userRecord.district,
					email: userRecord.email,
					weight: +userRecord.total_weight_collected,
					lastUpdatedTime: userRecord.last_updated_at,
				};
			}
		}

		let paWaveTableUpdateSQL = ``;
		const gemModifierMap: {
			[key: string]: {
				operation: 'add' | 'subtract';
				value: number;
			};
		} = {};

		let { rewardType = 'type1', actualNumberOfCoinsThatCanBeAwarded = 0 } =
			await getNumberOfCoinsThatCanBeRewarded({ actionType: 'pa_wave_season_2020', country });
		for (const [key, value] of Object.entries(usersToReward)) {
			if (key in dbUserRecordMap) {
				const valueDifferenceBetweenNewAndOld = usersToReward[key].weight - dbUserRecordMap[key].weight;
				let shouldUpdate = valueDifferenceBetweenNewAndOld !== 0;

				if (shouldUpdate) {
					paWaveTableUpdateSQL += this.getSQL({
						mode: 'update',
						data: value,
						numberOfCoinsPerKg: actualNumberOfCoinsThatCanBeAwarded,
					});
					gemModifierMap[key] = {
						operation: valueDifferenceBetweenNewAndOld > 0 ? 'add' : 'subtract',
						value: Math.abs(valueDifferenceBetweenNewAndOld),
					};
				}
			} else {
				gemModifierMap[key] = {
					operation: 'add',
					value: usersToReward[key].weight,
				};
				paWaveTableUpdateSQL += this.getSQL({
					mode: 'insert',
					data: value,
					numberOfCoinsPerKg: actualNumberOfCoinsThatCanBeAwarded,
				});
			}
		}

		if (Object.values(errors).length > 0) {
			sendEmail({
				to: 'admin@grendayapp.com',
				message: Object.values(errors)
					.map((o) => o.errorMessage)
					.join('</br>'),
				subject: 'error - pa_wave_excel sheet has some issue',
			});
		}
		// If has users
		if (Object.keys(gemModifierMap).length === 0) {
			console.log('no change in since last run');
			return;
		}
		const getUserSQL = `
      SELECT details->'profile'->>'email' as email,
      unique_id as uid,
	  	country
      FROM 
      v1.users
      WHERE 
      details->'profile'->>'email' in (
        ${Object.keys(gemModifierMap).map((email) => `'${email}'`)}
			) AND
			country = '${country}'
      `;
		const userDetails = await Database.query.manyOrNone<{ email: string; uid: string; country: string }>(
			getUserSQL
		);
		for (const u of userDetails) {
			await Database.query.task(async (tx) => {
				const userWalletState = (await getUserCoinsFromDB({ uid: u.uid, country })).type1; // also creates a wallet if not present
				let totalCount = userWalletState.count;
				const coinsToAdd =
					(gemModifierMap[u.email].operation === 'add' ? 1 : -1) *
					gemModifierMap[u.email].value *
					actualNumberOfCoinsThatCanBeAwarded;
				totalCount += coinsToAdd;
				const walletUpdateSQL = await getWalletUpdateSQL({
					rewardType,
					totalCount,
					uid: u.uid,
					country: u.country,
				});

				await tx.none(walletUpdateSQL);
				const currentTimeStamp = getSystemISOString();
				let activity: UserCoinActivity = {
					balanceAfter: +totalCount,
					balanceBefore: +userWalletState.count,
					timeStamp: currentTimeStamp,
					actionType: 'pa_wave_season_2020',
					data: {
						email: u.email,
					},
					coinsRewarded: Math.round(coinsToAdd),
					deviceInfo: null,
					sessionId: 'pa_wave_season_2020',
				};

				sql = await getSQLForAddingCoinActivityToDB({ activity, uid: u.uid, country });
				await tx.none(sql);
			});
		}
		await Database.query.none(paWaveTableUpdateSQL);
	}

	getSQL({
		mode,
		data,
		numberOfCoinsPerKg,
	}: {
		mode: 'update' | 'insert';
		data: IRewardInfo;
		numberOfCoinsPerKg: number;
	}) {
		const totalCoinsToGive = Math.round(data.weight * numberOfCoinsPerKg);
		let sql = ``;
		if (mode === 'insert') {
			sql = `
			INSERT 
			INTO v1.pa_wave_pwoc_season_2020 
			(email, district, total_weight_collected, last_updated_at, total_coins_given)
	    VALUES ('${data.email}', '${data.district}', ${data.weight}, '${data.lastUpdatedTime}', ${totalCoinsToGive});`;
		} else if (mode === 'update') {
			sql = `
      UPDATE v1.pa_wave_pwoc_season_2020
      SET email='${data.email}', 
      district='${data.district}', 
      total_weight_collected='${data.weight}', 
      last_updated_at='${data.lastUpdatedTime}',
      total_coins_given='${totalCoinsToGive}'
	    WHERE email = '${data.email}';
      ;`;
		}

		return sql;
	}
}

export const getUserStatForPAWave2020_API = async (request: Request, response: Response) => {
	let hasError = false;
	function sendApiRes(code: number, description: string, result?: any) {
		const status = new Status();
		hasError = code !== 200;
		sendResponse({
			status: { ...status, code, description },
			result,
			response,
			request,
		});
	}

	const user = await isUserAuthenticated({ request }).catch((err) => {
		const { code, error } = err;
		sendApiRes(code, 'You must be logged in to continue...');
	});

	if (hasError) {
		return;
	}

	const { uid: userId } = user || {};

	let sql = `
  SELECT 
  email, 
  district, 
  total_weight_collected as weight, 
  total_coins_given as "totalGemsEarned"
	FROM v1.pa_wave_pwoc_season_2020 
	WHERE 
	email = 
  ( 
    SELECT 
    details->'profile'->>'email' as email
    FROM v1.users
    WHERE unique_id = '${userId}'
    LIMIT 1
  )
  ;
	`;

	const dbRes = await Database.query.oneOrNone(sql);
	sendApiRes(200, '', dbRes);
};
