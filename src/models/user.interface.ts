import { OverrideProps } from '.';
import { IShippingDetails } from '../controllers/user-portal';
import { TLongCountryCodes, TShortCountryCodes } from './countries.model';

export interface IUserProfile {
	email: string;
	fullName?: string;
	avatarUrl?: string;
	phone?: {
		number: string;
		code: string;
	};
	country?: string;
}

export interface DBUserDetails {
	profile: IUserProfile;
	shipping: IShippingDetails;
}

export interface IPhone {
	code: string;
	number: string;
}

export interface IUserInDB {
	phone?: string;
	uid: string;
	fullName?: string;
	email: string;
	avatarUrl: string;
	points?: string;
	country: TShortCountryCodes;
}

export type IUserProfileApiResponse = OverrideProps<
	IUserInDB,
	{
		country: TLongCountryCodes;
	}
>;
