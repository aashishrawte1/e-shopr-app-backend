import { Request, Response } from 'express';
import { getUserCountry } from '..';
import { Database } from '../../../database';
import { isUserAuthenticated, sendResponse, Status } from '../../../util';

export const barteringGetMatchesApi = async (request: Request, response: Response) => {
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

	const country = await getUserCountry({ authorizationKeyValMap: user });
	const { sourceProductId } = request.query as {
		sourceProductId: string;
	};

	const { uid = null } = user || {};
	const sql = `
select
    bulp.target_product_id as "productId",
    bpl.posted_by as "postedBy",
    bpl.title as "title",
    bpl.description as "description",
    bpl.price_min as "priceMin",
    bpl.price_max as "priceMax",
    bpl.tags as "tags",
    bpl.images as "images",
    usr.details #>>'{profile,fullName}' as "userName",
		usr.details #>>'{profile,avatarUrl}' as "userImage", 
		2 as "barteringLevel"
FROM
    v1.bartering_user_liked_products as bulp
    INNER JOIN v1.users as usr ON bulp.user_id = usr.unique_id
   INNER JOIN v1.bartering_product_list AS bpl ON bpl.product_id = bulp.target_product_id
WHERE
		bpl.country = '${country}' AND
		bulp.source_product_id = '${sourceProductId}' AND
    bulp.target_product_id in (
        SELECT
            source_product_id
        FROM
            v1.bartering_user_liked_products
        WHERE
            row('${sourceProductId}', target_product_id) = row(target_product_id, '${sourceProductId}')
    )
`;
	const dbRes = await Database.query.manyOrNone(sql).catch((e) => {
		console.error(`DB Error: ${barteringGetMatchesApi.name}`, e);
		sendApiRes(400, 'got some error');
	});
	if (hasError) {
		return;
	}
	sendApiRes(200, '', dbRes);
};
