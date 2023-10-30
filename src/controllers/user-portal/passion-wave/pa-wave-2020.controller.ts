import { createWriteStream, writeFileSync } from 'fs';
import { resolve } from 'path';
import {
	GoogleDriveFileDownloader,
	isUserAuthenticated,
	parseCSVToJSONFromFile,
	parseCSVToJSONFromText,
	sendResponse,
	Status,
} from '../../../util';
import { Request, Response } from 'express';
import { CronJob } from 'cron';
import { Database } from '../../../database';
import async from 'async';
interface IndividualJsonData {
	Email: string;
	'SUM of Kayak Distance (Km)': string;
	'SUM of SUP Distance (Km)': string;
	'SUM of Trash Weight (kg)': string;
	'SUM of Individual points': string;
	Team: string;
}
interface TeamJsonData {
	Email: string;
	'Team Name': string;
	'Team SUM of Kayak Distance (Km)': string;
	'Team SUM of SUP Distance (Km)': string;
	'Team SUM of Trash Weight (kg)': string;
	'Team SUM of Individual Total points': string;
}
interface ChartJsonData {
	Team: string;
	Points: string;
}

const teamSheetData: any = [];
const individualSheetData: any = [];
const chartSheetData: any = [];
export class PAWaveSheetSync {
	async sync() {
		console.log('STARTING SYNC OF PA SHEET');
		// const paWaveFormResponseSheetId = '19SBpbLbDhXz2hRsRwWmo9UoLkQYO1gb_S_tnbbHmbYQ';
		const individualStatSheetId = '1iVInWzCUjOgMLIkvdAM9VUsJDjvdNllKinu-CWCJsEQ';
		const teamStatSheetId = '15AF8aI9ghkBPymsgk-7SI2qIrtykeaCXBpUadCfANKw';
		const chartSheetId = '1Nnr_JU8fLQ5aE0ba4qdrrkaKvHkdnbI5Ve8DamYm52M';

		const getJsonDataFromGoogleSheet = async (sheetId: string) => {
			const fileResponse = await GoogleDriveFileDownloader.exportFile({
				fileId: sheetId,
				mimeType: 'text/csv',
			});

			return await parseCSVToJSONFromText({ str: fileResponse.data });
		};
		const teamSheetData = (await getJsonDataFromGoogleSheet(teamStatSheetId)) as TeamJsonData[];
		const individualSheetData = (await getJsonDataFromGoogleSheet(
			individualStatSheetId
		)) as IndividualJsonData[];
		const chartSheetData = (await getJsonDataFromGoogleSheet(chartSheetId)) as ChartJsonData[];

		// console.log({ teamSheetData, individualSheetData, chartSheetData });
		await this.insertIntoIndividualData(individualSheetData);
		await this.insertIntoTeamData(teamSheetData);
		await this.insetIntoChartData(chartSheetData);
	}

	public removeById = (arr, email) => {
		const requiredIndex = arr.findIndex((el) => {
			return el.email === String(email);
		});
		if (requiredIndex === -1) {
			return false;
		}
		return !!arr.splice(requiredIndex, 1);
	};

	public insertIntoIndividualData = async (data: any) => {
		console.log(data);
		await this.removeById(data, '');
		for (const d of data) {
			const email = d['Email'];
			const kDistance = d['SUM of Kayak Distance (Km)'];
			const sDistance = d['SUM of SUP Distance (Km)'];
			const tWeight = d['SUM of Trash Weight (Kg)'];
			const points = d['SUM of Total Individual points'];
			const teamName = d['Team'];

			const sql = `
				INSERT INTO v1.pwa_individual_total_2021 as u
			          (
			            email,
			            kayak_distance,
			            sup_distance,
			            trash_weight,
			            total_points,
			            team_name
			          )
			          VALUES
			          (
			            '${email}',
			            '${kDistance}',
			            '${sDistance}',
			            '${tWeight}',
			            '${points}',
			            '${teamName}'
			          )
			          ON CONFLICT (email)
			          DO UPDATE SET
			          kayak_distance = '${kDistance}',
			          sup_distance = '${sDistance}',
			          trash_weight = '${tWeight}',
			          total_points = '${points}',
			          team_name = '${teamName}'
			          WHERE u.email = '${email}';
			`;
			await Database.query.none(sql);
		}
	};

	public insertIntoTeamData = async (data: any) => {
		console.log('team stats', data);
		for (const d of data) {
			const email = d['Email'];
			const kDistance = d['Team SUM of Kayak Distance (Km)'];
			const sDistance = d['Team SUM of SUP Distance (Km)'];
			const tWeight = d['Team SUM of Trash Weight (Kg)'];
			const points = d['Team SUM of Total Individual points'];
			const teamName = d['Team Name'];

			const sql = `
						INSERT INTO v1.pwa_team_stats_2021 as u
						(
							email,
							team_name, 
							kayak_distance, 
							sup_distance, 
							trash_weight, 
							total_points
						)
						VALUES 
						(
							'${email}',
							'${teamName}',
							'${kDistance}',               
							'${sDistance}',
							'${tWeight}',
							'${points}'							
						)
						ON CONFLICT (team_name)
                DO UPDATE SET
                kayak_distance = '${kDistance}', 
                sup_distance = '${sDistance}', 
                trash_weight = '${tWeight}', 
                total_points = '${points}'
                WHERE u.team_name = '${teamName}';
				`;

			await Database.query.none(sql);
		}
	};

	public insetIntoChartData = async (data: any) => {
		for (const d of data) {
			const teamName = d['Team'];
			const total_points = d['Points'];

			const sql = `
				INSERT INTO v1.pwa_chart_data_2021 as c
				(
					team_name, 
					total_points
				)
				VALUES 
				(
					'${teamName}',
					'${total_points}'
				)
				ON CONFLICT (team_name)
				DO UPDATE SET 
				total_points = '${total_points}'
				WHERE c.team_name = '${teamName}';
			`;

			await Database.query.none(sql);
		}
	};
}

export const getUserStatForPWAEvent2021_API = async (request: Request, response: Response) => {
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

	const sql = `
	SELECT email as "email",
	kayak_distance as "kykdistance",
	sup_distance as "supdistance",
	trash_weight as "weight",
	total_points as "totalPoints",
	team_name as "teamName"
	FROM v1.pwa_individual_total_2021
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
	// 'SKRheMZdwXWZ6dBiaodIt5ZAz2e2'
	const dbRes = await Database.query.oneOrNone(sql);
	sendApiRes(200, '', dbRes);
};

export const getTeamStatForPWAEvent2021_API = async (request: Request, response: Response) => {
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

	const sql = `
	SELECT email as "email", 
	team_name as "teamName", 
	kayak_distance as "kykdistance", 
	sup_distance as "supdistance", 
	trash_weight as "weight", 
	total_points as "totalPoints"
	FROM v1.pwa_team_stats_2021 
	where team_name = (select team_name from v1.pwa_individual_total_2021 where email =
	(
	  SELECT
	  details->'profile'->>'email' as email
	  FROM v1.users
	  WHERE unique_id = '${userId}'
	  LIMIT 1
	)
	);
	`;
	// 'SKRheMZdwXWZ6dBiaodIt5ZAz2e2'
	const dbRes = await Database.query.oneOrNone(sql);
	sendApiRes(200, '', dbRes);
};

export const getTop10TeamStatForPWAEvent2021_API = async (request: Request, response: Response) => {
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

	// const user = await isUserAuthenticated({ request }).catch((err) => {
	// 	const { code, error } = err;
	// 	sendApiRes(code, 'You must be logged in to continue...');
	// });

	// if (hasError) {
	// 	return;
	// }

	// const { uid: userId } = user || {};

	const sql = `SELECT team_name as teamName, total_points as totalPoints
	FROM v1.pwa_chart_data_2021;`;

	const dbRes = await Database.query.many(sql);
	sendApiRes(200, '', dbRes);
};
