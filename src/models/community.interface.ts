import { IMedia, IStatistics } from '.';
export type CommunityTypes = 'post' | 'space';
export interface ICommunity {
	id: string;
	title: string;
	media: IMedia[];
	ownerName: string;
	statistics: IStatistics;
	type: CommunityTypes;
	description?: string;
}

export interface IPost extends ICommunity {
	statistics: IStatistics;
}

export interface ISpace extends ICommunity {}

export interface IPostDetail extends IPost {
	comments: IComment[];
}
export interface ISpaceDetail extends ISpace {
	comments: IComment[];
}

export interface IComment {
	description: string;
	postedAt: string;
	postedBy: {
		id: string;
		name: string;
		avatar?: string;
	};
}
