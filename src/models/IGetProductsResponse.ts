import { ICartFullDetailsItem, IMedia, ApiResponse } from '.';

export interface IGetProductsResponse extends ApiResponse {
	result: IProductResult[] | ICartFullDetailsItem[];
}

export interface IGetCartResponse extends ApiResponse {
	result: ICartFullDetailsItem[];
}

export interface IProductResult {
	uniqueId: string;
	media: IMedia[];
	owner: string;
	ownerName: string;
	price: number;
	title: string;
	description: IProductDescriptionItem[];
	delivery: {
		fee: number;
		description: string;
	};
	tags: ITags;
	avatarUrl: string;
}

export interface IProductDescriptionItem {
	type: 'header' | 'content';
	text: 'Story' | 'Product' | 'Delivery' | 'Source' | string;
}

export interface ITags {
	key: string;
	value: boolean;
}
