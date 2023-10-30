import { getCoinActionListDB } from '.';
import { Database } from '../../database';
import { TShortCountryCodes, UserActionType, UserCoinActivity } from '../../models';
import { getSystemISOString } from '../../util';
import { coinConversionInfo, getUserCoinsFromDB } from './get-user-coins.controller';
import { getUserCountry } from './user.controller';

export const getWalletUpdateSQL = async ({ rewardType, totalCount, uid, country }) => {
	return `UPDATE v1.coin_wallet SET details = jsonb_set(details, '{${rewardType}}', '{"count": ${Math.round(
		totalCount
	)}, "updatedOn": "${getSystemISOString()}"}', true) WHERE user_id = '${uid}' AND country='${country}'`;
};

export const getSQLForAddingCoinActivityToDB = async ({
	uid,
	activity,
	country,
}: {
	uid: string;
	activity: UserCoinActivity;
	country: TShortCountryCodes;
}) => {
	return `
	INSERT INTO v1.coin_activity_list(user_id, details, country) 
	VALUES('${uid}', '${JSON.stringify(activity)}', '${country}');`;
};

export const getNumberOfCoinsThatCanBeRewarded = async ({
	actionType,
	country,
}: {
	actionType: UserActionType;
	country: TShortCountryCodes;
}) => {
	const coinActionList = await getCoinActionListDB({ country });
	let { rewardType = 'type1', coins: actualNumberOfCoinsThatCanBeAwarded = 10000 } = coinActionList.find(
		(cal) => cal.actionType === actionType
	) || { rewardType: 'type1' };
	actualNumberOfCoinsThatCanBeAwarded = +actualNumberOfCoinsThatCanBeAwarded;

	return { rewardType, actualNumberOfCoinsThatCanBeAwarded };
};

export const updateWallet = async ({
	uid,
	activity,
	country,
}: {
	uid: string;
	activity: UserCoinActivity;
	country: TShortCountryCodes;
}) => {
	const CURRENT_DAILY_EARN_COIN_THRESHOLD = 1000000;

	const userCountry = await getUserCountry({ authorizationKeyValMap: { refreshToken: '', uid } });
	let {
		rewardType = 'type1',
		actualNumberOfCoinsThatCanBeAwarded = 0,
	} = await getNumberOfCoinsThatCanBeRewarded({ actionType: activity.actionType, country });

	await Database.query.task(async (t) => {
		const userWalletState = await getUserCoinsFromDB({ uid, country: userCountry });

		let balanceBefore = +userWalletState.type1.count; // coin count
		let balanceAfter = 0; // coin count

		if (activity.actionType === 'gem_used_for_purchase') {
			const remainingValue = +userWalletState.type1.value - +activity.data.valueUsed;
			balanceAfter = Math.round(
				remainingValue *
					+(userCountry === 'sg' ? coinConversionInfo.sg.type1.count : coinConversionInfo.my.type1.count)
			);
			activity = { ...activity, coinsUsed: balanceBefore - balanceAfter };
		} else {
			balanceAfter = Math.round(+balanceBefore + actualNumberOfCoinsThatCanBeAwarded);
			activity = { ...activity, coinsRewarded: actualNumberOfCoinsThatCanBeAwarded, country: userCountry };
		}

		if (balanceAfter - balanceBefore > actualNumberOfCoinsThatCanBeAwarded) {
			const error = {
				code: 400,
				description: 'Coin balance error',
			};
			throw new Error(JSON.stringify(error));
		}

		const usersFirstActivityToday = await getUsersFirstActivityToday({ uid, country: userCountry });

		// if have then do the fail safe check
		if (usersFirstActivityToday) {
			const dayStartBalance = +usersFirstActivityToday.balanceBefore || 0;
			const totalCoinsEarnedSoFarForToday = balanceAfter - dayStartBalance;
			if (
				totalCoinsEarnedSoFarForToday > CURRENT_DAILY_EARN_COIN_THRESHOLD &&
				activity.actionType !== 'gem_used_for_purchase'
			) {
				const error = {
					code: 400,
					description: 'Daily gem earn threshold reached. ',
				};
				throw new Error(JSON.stringify({ error, forUser: uid }));
			}
		}

		let sql = await getWalletUpdateSQL({ totalCount: balanceAfter, rewardType, uid, country: userCountry });
		await t.none(sql);

		const currentTimeStamp = getSystemISOString();
		activity = { ...activity, balanceAfter, balanceBefore, timeStamp: currentTimeStamp };

		sql = await getSQLForAddingCoinActivityToDB({ activity, uid, country });
		await t.none(sql);
		return true;
	});
};

export const getUsersFirstActivityToday = async ({ uid, country }: { uid: string; country: string }) => {
	const sql = `	
		SELECT 
		a.user_id as "userId",
		u.details->'profile'->'email' as "email",
		a.details->>'balanceBefore' as "balanceBefore",  
		a.details->>'balanceAfter' as "balanceAfter", 
		a.details->>'timeStamp' as timestamp
		FROM v1.coin_activity_list a 
		INNER JOIN v1.users u 
		ON a.user_id = u.unique_id
		WHERE 
		a.country ='${country}' AND
		a.details->>'timeStamp' IS NOT NULL AND
		date(a.details->>'timeStamp') = date(now()) AND
		a.user_id = '${uid}'
		ORDER BY timestamp ASC 
		LIMIT 1;
	`;

	return await Database.query.oneOrNone(sql);
};
