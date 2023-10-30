export interface IQuizItem {
	quizId: string;
	title: string;
	options: string[];
}
export interface IHeadline {
	content: string;
	deepLink: string;
}

export interface IPopularItems {
	quiz: IQuizItem;
	headlines: IHeadline[];
}
