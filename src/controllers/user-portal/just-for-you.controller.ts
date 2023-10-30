import { Request, Response } from 'express';
import { getSQLQueryForProductsWithOptions, getUserRegistrationQuizResponse } from '.';
import { Database } from '../../database';
import { ProductSortingType } from '../../models';
import { isUserAuthenticated, fetchUserRelatedTags } from '../../util';
import { sendResponse, Status } from '../../util/log-response.util';
import { getUserCountry } from './user.controller';

export const getJustForYouFromDB = async ({
	uid,
	start,
	end,
	sorting,
	country: country,
}: {
	uid: string;
	start: number;
	end: number;
	sorting: ProductSortingType;
	country: string;
}) => {
	let hasError = false;
	let userRelevantTags: Array<string>;
	let quizResponseList = await getUserRegistrationQuizResponse(uid);
	userRelevantTags = fetchUserRelatedTags(quizResponseList || []);

	const totalNumberOfItemsToReturn = +end - +start;

	let productsToReturn: void | any[] = [];
	if (userRelevantTags?.length) {
		const tagsForDBQuery = userRelevantTags.map((tag) => `'${tag}'`).join(',');
		const getProductIdsSQL = `
			SELECT * FROM 	
			(
				SELECT unique_id as "productId"
				FROM
				v1.products p
				WHERE
				(p.details->'tags') ?| array[${tagsForDBQuery}] AND
				p.selling_countries @> '["${country}"]'
				ORDER BY random() limit ${totalNumberOfItemsToReturn}
			) product_ids 
			
			ORDER BY random()
		`;

		const productIdList = (await Database.query.many(getProductIdsSQL)).map((m) => m.productId);

		productsToReturn = await Database.query
			.many(
				getSQLQueryForProductsWithOptions({
					country,
					filters: {
						idList: productIdList,
					},
					sorting,
				})
			)
			.catch((error) => {
				console.error('Just for you error', error);
				hasError = true;
			});
	} else {
		let tagsList = [];
		const sql = `
			SELECT 
			details->>'tags' AS tags 
			FROM v1.products 
			WHERE unique_id IN 
			(SELECT SUBSTRING(details->'data'->>'url',32) AS "uniqueId" FROM 
			v1.analytics a 
			WHERE a.details->>'userId'='${uid}' AND 
			a.country = '${country}' AND
			a.details->'data'->>'url' LIKE '/pages/product-detail%');
    `;
		tagsList = await Database.query.manyOrNone(sql);

		let tags = [];
		for (let tag of tagsList) {
			for (let i of Object.keys(JSON.parse(tag.tags))) {
				if (JSON.parse(tag['tags'])[i] === 1 || JSON.parse(tag['tags'])[i] === 2) {
					tags.push(i);
				}
			}
		}
		if (!tags.join(',')?.length) {
			return productsToReturn;
		}
		productsToReturn = await Database.query
			.manyOrNone(
				getSQLQueryForProductsWithOptions({
					tags: tags.join(','),
					start,
					end,
					sorting,
					country,
				})
			)
			.catch((error) => {
				console.error('Just for you error', error);
				hasError = true;
			});
	}

	if (hasError) {
		return;
	}

	return productsToReturn;
};

export async function getJustForYouProducts_API(request: Request, response: Response) {
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

	const authorizationKeyValMap = await isUserAuthenticated({ request }).catch((error) => {
		sendApiRes(400, 'You must be logged in to be able to call this api.');
	});

	if (hasError) {
		return;
	}

	const { uid = null } = authorizationKeyValMap || {};
	const country = await getUserCountry({ authorizationKeyValMap });
	const { start, end, sorting } = (request.query as unknown) as {
		start: number;
		end: number;
		sorting: ProductSortingType;
	};
	const products = (await getJustForYouFromDB({ uid, start, end, sorting, country })) || [];
	sendApiRes(200, '', products);
}
