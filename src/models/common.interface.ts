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

export interface IStatistics {
	commentCount: number;
	shareCount: number;
	reactionCount: number;
}
