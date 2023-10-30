import { Request, Response } from 'express';
import { Database } from '../../database';
import { ProductSortingType } from '../../models';
import { getRandomItems, parseAuthorizationHeader } from '../../util';
import { sendResponse, Status } from '../../util/log-response.util';
import { getSQLQueryForProductsWithOptions } from './get-products-based-on-query';
import { getUserCountry } from './user.controller';

export const getPopularProducts = async ({
	start,
	end,
	orderRowRandomly = false,
	sorting,
	country,
}: {
	start: number;
	end: number;
	orderRowRandomly: boolean;
	sorting: ProductSortingType;
	country: string;
}) => {
	return Database.query.task(async (t) => {
		let sql = `
        SELECT tr.uid as matched_product_id FROM (
        SELECT ROW_NUMBER() over (
                        order by ${orderRowRandomly ? 'random()' : 'pr.uid'}
                    ),
                    pr.uid
                from (
                        SELECT d.productid as uid
                        from (
                                select distinct c.productid,
                                    c.user
                                from (
                                        select a.id,
                                            a.details->>'timeStamp' as datetime,
                                            a.details->'data'->>'itemName' as product,
                                            a.details->'data'->>'productId' as productid,
                                            b.details->'profile'->'fullName' as user
                                        from v1.analytics a
                                            left join v1.users b on a.details->>'userId' = b.unique_id
																				where a.details->>'eventType' = 'fb_mobile_add_to_cart' AND
																				a.country = '${country}'
																				
                                    ) c
                                where c.user is not null
                            ) d
                            inner join v1.products p ON p.unique_id = d.productid
												WHERE p.details->'active' = 'true'
												 group by d.productid
                        order by count(d.*) desc
                    ) pr
            ) tr
        `;
		const dbResponse = await t.manyOrNone(sql);
		const idList = dbResponse.map((i) => i.matched_product_id);
		sql = getSQLQueryForProductsWithOptions({
			sorting,
			start,
			end,
			filters: {
				idList,
			},
			country,
		});
		return t.manyOrNone(sql);
	});
};

export const getPopularProductsApi_UP = async (request: Request, response: Response) => {
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

	const { start, end, sorting } = (request.query as unknown) as {
		start: number;
		end: number;
		sorting: ProductSortingType;
	};
	const authorizationKeyValMap = parseAuthorizationHeader(request);
	const country = await getUserCountry({ authorizationKeyValMap });

	let dbRes = (await getPopularProducts({
		start,
		end,
		sorting,
		orderRowRandomly: false,
		country,
	}).catch((_) => {
		sendApiRes(500, 'could not get list', null);
	})) as any;

	if (hasError) {
		return;
	}

	sendApiRes(200, '', sorting !== 'best-match' ? dbRes : getRandomItems(dbRes, dbRes.length));
};
