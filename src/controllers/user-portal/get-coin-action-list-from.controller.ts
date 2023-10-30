import { Request, Response } from 'express';
import { getUserCountry } from '.';
import { Database } from '../../database';
import { CoinActionListFromDB, TShortCountryCodes } from '../../models';
import { parseAuthorizationHeader } from '../../util';
import { sendResponse, Status } from '../../util/log-response.util';

// make sure the coin's action type is always unique. so if 10 product is added, the actionType should be easily figured out.
export const getCoinActionListDB = async ({ country }: { country: TShortCountryCodes }) => {
	const sql = `
	SELECT action as "actionType", 
	details->>'rewardType' as "rewardType", 
	details->'conditions' as "conditions", 
	details->>'coins' AS "coins" FROM 
	v1.coin_action_list 
	WHERE country = '${country}'
	`;
	return Database.query.manyOrNone<CoinActionListFromDB>(sql);
};

export const getCoinActionListApi_UP = async (request: Request, response: Response) => {
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

	const authorizationKeyValMap = parseAuthorizationHeader(request);
	const country = await getUserCountry({ authorizationKeyValMap });
	const dbRes = await getCoinActionListDB({ country }).catch((e) => {
		console.error(`DB Error: ${getCoinActionListApi_UP.name}`, e);
		sendApiRes(500, 'could not find list');
	});

	if (hasError) {
		return;
	}
	sendApiRes(200, '', dbRes);
};
