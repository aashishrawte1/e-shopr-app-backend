import { Request, Response } from 'express';
import { Database } from '../../database';
import { sendResponse, Status } from '../../util/log-response.util';

export const getLinksFromDB_UP = async ({
	tags,
	limit = 100,
}: {
	tags: string;
	limit: number;
	orderBy: string;
}) => {
	let sql = `SELECT 
        ROW_NUMBER() OVER(partition by details#>'{siteName}' order by random()),
		unique_id          as "uniqueId",
		owner				as "owner",
		website_url		as "url",
		details#>'{title}'	as "title",
		details#>'{favicons}'	as "favicon",
		details#>'{siteName}'	as "siteName",
		details#>'{mediaType}'	as "mediaType",
		details#>'{description}'	as "description",
		details#>'{images}'	as "images"
FROM v1.link as link `;

	if (tags) {
		sql += ` WHERE (details->'tags') ?| array[${tags
			.split(',')
			.map((tag) => `'${tag.toLowerCase()}'`)
			.join(',')}] `;
	}

	sql += `order by row_number asc `;

	if (limit) {
		sql += ` limit ${limit} `;
	}

	sql += ` ;`;

	const dbRes = await Database.query.manyOrNone(sql);
	return dbRes;
};

export const getArticles_API = async (request: Request, response: Response) => {
	const status = new Status();
	const dbRes = await getLinksFromDB_UP(request.query as any).catch((e) => {
		console.error(`DB Error: ${getArticles_API.name}`, e);
		status.code = 500;
	});

	sendResponse({ status, result: dbRes, response, request });
};
