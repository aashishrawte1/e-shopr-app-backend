import Bluebird from 'bluebird';
import nodeFetch from 'node-fetch';
nodeFetch['Promise'] = Bluebird;
export const downloadImage = async (imageUrl: string) => {
	const res = await nodeFetch(imageUrl);

	if (!(res && res.status === 200)) {
		console.log('status is not 200 so returning');
		throw new Error('Status is not 200');
	}

	const contentType = res.headers.get('content-type');

	if (
		!(
			contentType === 'image/png' ||
			contentType === 'image/jpeg' ||
			contentType === 'image/svg+xml' ||
			contentType === 'image/gif'
		)
	) {
		throw new Error('Image is not in recognizable image format');
	}

	return { body: res.body, headers: res.headers };
};
