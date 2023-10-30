import { IMedia } from '.';

export interface IProduct {
	id: string;
	title: string;
	media: IMedia[];
	description: string;
	merchantName: string;
	price: number;
}

export interface IProductDetail extends IProduct {
	price: number;
}

export type ProductSortingType = 'best-match' | 'price-low-high' | 'price-high-low';
