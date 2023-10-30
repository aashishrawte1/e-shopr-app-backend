import tagsList from '../json-data/quiz-response-related-tags.json';
export function fetchUserRelatedTags(quizResponse: Array<string>) {
	return (quizResponse || [])
		.map((r) => r.split(','))
		.reduce((acc, val) => acc.concat(val), [])
		.map((v) =>
			tagsList[v].reduce((accumulator: string | any[], value: any) => accumulator.concat(value), [])
		)
		.reduce((accumulator, value) => accumulator.concat(value), [])
		.filter((value: string, index: number, self: string | Array<string>) => self.indexOf(value) === index);
}
