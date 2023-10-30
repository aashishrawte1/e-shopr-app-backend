import { ICartFullDetailsItem } from '.';

export interface IShoppingCart {
	[key: string]: {
		[key: string]: ICartFullDetailsItem;
	};
}

export interface ICostBreakdown {
	shipping: number;
	subtotal: number;
	total: number;
}

export interface ICostMap {
	[key: string]: ICostBreakdown;
}
