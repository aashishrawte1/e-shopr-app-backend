import { IShoppingCart, ICostBreakdown, ApiResponse } from '.';

export interface IGetOrdersResponse extends ApiResponse {
	result: IOrderResult[];
}

export interface IOrderResult {
	uniqueId: string;
	ordered_at: string;
	referenceId: string;
	payment: IPaymentMode;
	products: IShoppingCart;
	finalCost?: ICostBreakdown;
}

export interface IPaymentMode {
	mode: string;
	amount: number;
}
