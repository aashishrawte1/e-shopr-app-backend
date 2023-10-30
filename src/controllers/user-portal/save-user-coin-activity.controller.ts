import { Request, Response } from 'express';
import { updateWallet, getReferrerUniqueId, getUserProfileDB_UP, rewardAppReferrer, getUserCountry } from '.';
import { UserCoinActivity } from '../../models';

import { isUserAuthenticated, parseAuthorizationHeader } from '../../util';
import { sendResponse, Status } from '../../util/log-response.util';

export const saveUserCoinActivity_API = async (request: Request, response: Response) => {
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

	let user = await isUserAuthenticated({ request }).catch((err) => {
		const { code } = err;
		sendApiRes(code, 'You must be logged in to continue...');
	});

	if (hasError) {
		return;
	}

	const { uid } = user || {};

	const userPresent = await getUserProfileDB_UP({ userId: uid });
	if (!!!userPresent) {
		sendApiRes(403, 'request is not valid');
	}
	if (hasError) {
		return;
	}
	const authorizationKeyValMap = parseAuthorizationHeader(request);
	const country = await getUserCountry({ authorizationKeyValMap });
	const { activityList, sessionId, deviceInfo } = request.body;

	try {
		if (!(activityList && activityList.length)) {
			throw 'no activity to process';
		}
	} catch (error) {
		sendApiRes(400, 'total coins calculation error.');
	}

	if (hasError) {
		return;
	}

	const activity = activityList[0] as UserCoinActivity;

	if (activity.actionType === 'referee_claimed') {
		const refereeUserId = uid;
		const { referralCode } = activity.data;
		if (!referralCode) {
			sendApiRes(403, 'no referral code was provided');
		}

		if (hasError) {
			return;
		}

		await updateWallet({ uid, activity: { ...activity, sessionId, deviceInfo }, country });
		const referrerDetails = await getReferrerUniqueId({ referralCode });
		await updateWallet({
			uid: referrerDetails.uniqueId,
			activity: { ...activity, actionType: 'referer_awarded', sessionId, deviceInfo },
			country,
		});

		rewardAppReferrer({
			referralCode,
			rewardClaimerUid: refereeUserId,
			referrerUserUid: referrerDetails.uniqueId,
		});
	} else {
		await updateWallet({ uid, activity: { ...activity, sessionId, deviceInfo }, country });
	}

	if (hasError) {
		return;
	}

	sendApiRes(200, 'success');
};
