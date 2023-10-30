export interface IMedia {
	type: 'image' | 'video';
	link: string;
}

export interface IRange {
	start: number;
	end: number;
}

export class IRangeTracker {
	previous = {} as IRange;
	current: IRange = {
		start: 1,
		end: 10
	};
}

export interface IActionButtonClicked {
	description: string;
	uniqueId: string;
	positive?: boolean;
}

export interface IComment {
	description: string;
	postedAt: string;
	owner: string;
	postedBy: {
		id: string;
		name: string;
		avatar?: string;
	};
}

export type ActionItemType = 'product' | 'space' | 'post' | 'product-detail' | 'article';

export interface Statistics {
	commentCount: number;
	shareCount: number;
	reactionCount: number;
	currentUser: CurrentUser;
	reactionCountByUser?: number;
}
export interface CurrentUser {
	reacted: boolean;
	shared: boolean;
	commented?: boolean;
}
