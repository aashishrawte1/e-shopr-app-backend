// *** Generic ***
export interface ApiResponse {
	status: {
		code: string;
		description: string;
	};
	result: any;
}
