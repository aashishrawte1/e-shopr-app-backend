import { Request, Response } from 'express';
import { getSQLQueryForProductsWithOptions, getUserCountry } from '.';
import { Database } from '../../database';
import { getSystemISOString, isUserAuthenticated, parseAuthorizationHeader } from '../../util';
import { sendResponse, Status } from '../../util/log-response.util';

export const getLikedProductsForUser_API = async (request: Request, response: Response) => {
	let hasError = false;
	function sendApiRes(code: number, description: string, result?: any) {
		const status = new Status();
		hasError = code !== 200;
		sendResponse({
			status: { ...status, code, description },
			result,
			response,
			request,
		});
	}

	const authorizationKeyValMap = await isUserAuthenticated({ request }).catch((err) => {
		const { code, error } = err;
		sendApiRes(code, 'You must be logged in to continue...');
	});

	if (hasError) {
		return;
	}

	const { uid } = authorizationKeyValMap || {};

	const country = await getUserCountry({ authorizationKeyValMap });

	const dbRes = await Database.query
		.task(async (t) => {
			const likedProductIds = await t.manyOrNone(`SELECT product_id from v1.product_like_tracker 
		WHERE user_id='${uid}' AND
		country='${country}'
		order by liked_at desc`);
			if (!(likedProductIds && likedProductIds.length)) {
				return;
			}

			return await t.manyOrNone(
				getSQLQueryForProductsWithOptions({
					country,
					start: 0,
					end: 200,
					filters: {
						idList: likedProductIds.map((l) => l.product_id),
					},
				})
			);
		})
		.catch((e) => {
			console.error(`DB Error: ${getLikedProductsForUser_API.name}`, e);
			sendApiRes(500, 'db error');
		});

	if (hasError) {
		return;
	}
	sendApiRes(200, '', dbRes);
};

export const updateProductLike_API = async (request: Request, response: Response) => {
	let hasError = false;
	function sendApiRes(code: number, description: string, result?: any) {
		const status = new Status();
		hasError = code !== 200;
		sendResponse({
			status: { ...status, code, description },
			result,
			response,
			request,
		});
	}

	const user = await isUserAuthenticated({ request }).catch((err) => {
		const { code, error } = err;
		sendApiRes(code, 'You must be logged in to continue...');
	});
	const authorizationKeyValMap = parseAuthorizationHeader(request);
	const country = await getUserCountry({ authorizationKeyValMap });
	if (hasError) {
		return;
	}

	const { uid: userId } = user || {};
	const { uniqueId: productId } = request.body;

	let sql: string;

	await Database.query
		.task(async (t) => {
			const result = await t.oneOrNone(
				`SELECT product_id from v1.product_like_tracker 
				WHERE 
				user_id='${userId}' AND 
				product_id='${productId}' AND 
				country='${country}'
				`
			);

			if (!result) {
				sql = `INSERT into v1.product_like_tracker(user_id, product_id, liked_at, country) 
     		values('${userId}','${productId}','${getSystemISOString()}','${country}')`;
				return t.none(sql);
			}
			sql = `DELETE FROM 
			v1.product_like_tracker 
			WHERE 
			product_id='${productId}' AND 
			user_id='${userId}' AND
			country='${country}'
			`;
			return t.none(sql);
		})
		.catch((_) => {
			sendApiRes(500, '');
		});
	if (hasError) {
		return;
	}

	sendApiRes(200, '');
};
