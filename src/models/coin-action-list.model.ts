export type UserActionType =
	| 'product_view'
	| 'daily_login_reward'
	| 'gem_used_for_purchase'
	| 'referee_claimed'
	| 'referer_awarded'
	| 'referer_shared_code'
	| 'coin_manually_added_by_greenday_to_users'
	| 'share_product'
	| 'kk_season_2021'
	| 'pa_wave_season_2020';

export type CoinTypes = 'type1' | 'type2' | 'type3' | 'type4';
export class CoinActionListFromDB {
	actionType: UserActionType;
	rewardType: string;
	conditions: string;
	coins: number;
}

export class UserCoinActivity {
	actionType: UserActionType;
	data: any;
	deviceInfo: {
		appVersion: string;
		platform: string;
		uuid: string;
	};
	timeStamp?: string;
	sessionId: string;
	balanceAfter?: number;
	balanceBefore?: number;
	coinsRewarded?: number;
	coinsUsed?: number;
	country?: string;
}
