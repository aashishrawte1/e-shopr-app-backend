import { ApiResponse } from '../util/log-response.util';
import { IProductResult } from '.';

export interface IGetMixedDataResponse extends ApiResponse {
	result: IMixedDataResult;
}

export interface IMixedDataResult {
	products: IProductResult[];
	links: any[];
	tags: string;
	type: string;
}
