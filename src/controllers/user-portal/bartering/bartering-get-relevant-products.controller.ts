import { Request, Response } from 'express';
import { getUserCountry } from '..';
import { Database } from '../../../database';
import { isUserAuthenticated, sendResponse, Status } from '../../../util';

export const barteringGetRelevantProductsApi = async (request: Request, response: Response) => {
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
	if (hasError) {
		return;
	}

	const { uid: userId = null } = user || {};
	const country = await getUserCountry({ authorizationKeyValMap: user });

	const { selectedProductId } = request.query as { selectedProductId: string };

	if (!(selectedProductId && userId && country && selectedProductId !== 'undefined')) {
		sendApiRes(400, 'no product id provided');
		return;
	}

	const productsWithRelevanceSQL = await getRelevantProductsSQL({
		sourceProductId: selectedProductId,
		country,
		userId,
		withDescription: false,
	}).catch((error) => {
		console.error(`DB Error: ${barteringGetRelevantProductsApi.name}`, error);
		sendApiRes(400, 'error in fetching product');
	});

	if (hasError) {
		return;
	}

	const sql = `
	SELECT * FROM ${productsWithRelevanceSQL} as items_with_relevance
	`;

	const dbRes = await Database.query.manyOrNone(sql).catch((e) => {
		console.error(`DB Error: ${barteringGetRelevantProductsApi.name}`, e);
		sendApiRes(400, 'error in fetching product');
	});

	if (hasError) {
		return;
	}

	sendApiRes(200, '', dbRes);
};

export const getRelevantProductsSQL = async ({
	sourceProductId,
	country,
	userId,
	withDescription,
}: {
	sourceProductId: string;
	country: string;
	userId: string;
	withDescription: boolean;
}) => {
	if (!sourceProductId) {
		throw new Error('no productId was provided with which relevant products can be returned. Duh.');
	}

	const sqlForSelectedProduct = `
	SELECT 
	price_min  as "priceMin",
	price_max as "priceMax"
	FROM "v1".bartering_product_list 
	WHERE
	product_id = '${sourceProductId}';
	`;

	const { priceMax, priceMin } = await Database.query.one(sqlForSelectedProduct);
	const sql = `
	(WITH products_table as (
    (
	SELECT 
	product_list.product_id as "productId",
	product_list.posted_by  as "postedBy",
	product_list.title as "title",
	${withDescription ? 'product_list.description' : `''`} as "description",
	product_list.price_min  as "priceMin",
	product_list.price_max as "priceMax",
	product_list.tags  as "tags",
	product_list.images as "images",
	u.details#>>'{profile,fullName}' as "userName",
	u.details#>>'{profile,avatarUrl}' as "userImage",
	jsonb_build_object
			(
				'userReactions', 
				jsonb_build_object(
					'likesCount', 0
				),
				'currentUser', 
				jsonb_build_object(
					'liked', (SELECT true FROM 
						v1.bartering_user_liked_products
						WHERE source_product_id = '${sourceProductId}' AND
						target_product_id = product_list.product_id)
				)
			) as "statistics"
	FROM v1.bartering_product_list as product_list
	INNER JOIN v1.users as u ON product_list.posted_by = u.unique_id 
	WHERE
	product_list.posted_by!='${userId}' AND 
	product_list.country='${country}'

	    )
)
(
SELECT
*
FROM
(
                    
		SELECT
			*, 
		round((((least (${priceMax},"priceMax") - greatest(${priceMin},"priceMin"))/
		(greatest(${priceMax},"priceMax") - least(${priceMin},"priceMin"))) * 100)) as "relevancyScore"
	FROM
			products_table
		) as filtered_table
		WHERE 
		(
			filtered_table."priceMax" - filtered_table."priceMin"
		) > 0
		AND CASE
			WHEN ${priceMin} = ${priceMax}  THEN filtered_table."relevancyScore" is not null
			ELSE filtered_table."relevancyScore" >= 1
		END
	)
	UNION ALL
	(SELECT
			*,
		100 as "relevancyScore"
	FROM
			products_table
	WHERE
			("priceMax" - "priceMin") = 0
	))
	`;
	return sql;
};
