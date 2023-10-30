import { Request, Response } from 'express';

export interface AuthorizationHeaderKeyValues {
	uid: string;
	refreshToken: string;
}
export const parseAuthorizationHeader = (request: Request): AuthorizationHeaderKeyValues | null => {
	const authorization = request.headers.authorization;

	let user: any;
	if (!authorization) {
		user = null;
	} else {
		const authHeaders = authorization.split(' ');
		if (!(authHeaders && authHeaders.length >= 4)) {
			user = null;
		} else {
			user = {
				uid: authHeaders[1].trim(),
				refreshToken: authHeaders[3].trim(),
			};
		}
	}

	return user;
};

export const isUserAuthenticated = async ({
	request,
}: {
	request: Request;
}): Promise<AuthorizationHeaderKeyValues> => {
	const user = parseAuthorizationHeader(request);

	if (!(user && user.uid && user.refreshToken)) {
		const res = {
			error: 'user information not present',
			code: 403,
		};

		throw new Error(JSON.stringify(res));
	}

	return user;
};
