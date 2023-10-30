import Bluebird from 'bluebird';
import nodeFetch, { HeadersInit } from 'node-fetch';
nodeFetch['Promise'] = Bluebird;

export const fetchAFile = async ({ fileUrl, fileType }: { fileUrl: string; fileType: 'json' | 'text' }) => {
	return await (await nodeFetch(fileUrl))[fileType]();
};

export const callApi = async ({ url, headers }: { url: string; headers?: HeadersInit }) => {
	return await (
		await nodeFetch(url, {
			headers: (headers || {}) as any,
		})
	).json();
};
