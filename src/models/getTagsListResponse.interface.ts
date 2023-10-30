import { ApiResponse } from '../util/log-response.util';

export interface IGetTagsListResponse extends ApiResponse {
	result: Tag[];
}

export interface Tag {
	text: string;
	selected: boolean;
}
