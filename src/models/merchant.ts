import { IUserProfile } from './user.interface';

export interface MerchantDetails {
	profile: MerchantProfile;
}

interface MerchantProfile extends IUserProfile {
	isAdmin: boolean;
}
