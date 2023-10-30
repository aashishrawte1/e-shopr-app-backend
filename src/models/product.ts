import { IProductResult } from '.';

export interface ICartFullDetailsItem extends IProductResult {
	count: number;
	noteToSeller: string;
}
