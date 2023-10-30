import { Request, Response } from 'express';
import { getSQLQueryForProductsWithOptions, getUserCountry, getUserRegistrationQuizResponse } from '.';
import { Database } from '../../database';
import { ProductSortingType } from '../../models';
import { fetchUserRelatedTags, parseAuthorizationHeader } from '../../util';
import { sendResponse, Status } from '../../util/log-response.util';

export const getForageItems_API = async (request: Request, response: Response) => {
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

	const { start, end } = (request.query as unknown) as {
		start: number;
		end: number;
		sorting: ProductSortingType;
	};
	const authorizationKeyValMap = parseAuthorizationHeader(request);
	const country = await getUserCountry({ authorizationKeyValMap });

	const uid = authorizationKeyValMap.uid;
	let userRelevantTags: Array<string>;
	if (uid) {
		let quizResponseList = await getUserRegistrationQuizResponse(uid);
		userRelevantTags = fetchUserRelatedTags(quizResponseList || []);
	}

	const totalNumberOfItemsToReturn = +end - +start;
	const numberOfRelevantItemsToReturn = Math.round((totalNumberOfItemsToReturn / 100) * 40);
	const numberOfPopularItemsToReturn = totalNumberOfItemsToReturn - numberOfRelevantItemsToReturn;

	let productsToReturn: void | any[] = [];
	if (userRelevantTags?.length) {
		const tagsForDBQuery = userRelevantTags.map((tag) => `'${tag}'`).join(',');
		const getProductIdsSQL = `
			SELECT * FROM 	
			(
				(	
					SELECT unique_id as "productId"
					FROM
					v1.products p
					WHERE
					(p.details->'tags') ?| array[${tagsForDBQuery}] AND
					p.selling_countries @> '["${country}"]'
					ORDER BY random() limit ${numberOfRelevantItemsToReturn}
				)
			UNION ALL
				(
					SELECT unique_id FROM v1.products WHERE unique_id IN (
						SELECT a.p FROM (
							SELECT COUNT(details->'data'->>'productId'), details->'data'->>'productId' AS p 
							FROM v1.analytics 
							WHERE details->>'eventType' = 'fb_mobile_add_to_cart'
							GROUP BY details->'data'->>'productId' 
							ORDER BY COUNT DESC
						) a
					) AND details->'active'='true' AND selling_countries='["${country}"]' limit ${numberOfPopularItemsToReturn}
				) 
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
				})
			)
			.catch((error) => {
				console.error('forage error', error);
				sendApiRes(400, 'got error in forage', null);
			});
	} else {
		const getProductIdsSQL = `
			SELECT * FROM 	
			(
				SELECT unique_id as "productId" FROM v1.products WHERE unique_id IN (
					SELECT a.p FROM (
						SELECT COUNT(details->'data'->>'productId'), details->'data'->>'productId' AS p 
						FROM v1.analytics 
						WHERE details->>'eventType' = 'fb_mobile_add_to_cart'
						GROUP BY details->'data'->>'productId' 
						ORDER BY COUNT DESC
					) a
				) AND details->'active'='true' AND selling_countries='["${country}"]' limit ${totalNumberOfItemsToReturn} 
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
				})
			)
			.catch((error) => {
				console.error('forage error', error);
				sendApiRes(400, 'got error in forage', null);
			});
	}

	if (hasError) {
		return;
	}

	sendApiRes(200, '', productsToReturn);
};
