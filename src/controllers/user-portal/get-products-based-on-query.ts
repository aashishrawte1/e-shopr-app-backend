import { ProductSortingType } from '../../models';
import { replaceSingleTickWithDoubleTick } from '../../util';
import { canAddOperator } from '../../util/can-add-sql-operator.util';
import { default as exclusiveMerchants } from './../../json-data/exclusive-merchants.json';
export type ProductQueryRowNumberLogicType =
	| 'PARTITION BY p.owner'
	| `ORDER BY CAST(pwd.selling_price AS DOUBLE PRECISION) DESC`
	| `ORDER BY CAST(pwd.selling_price AS DOUBLE PRECISION) ASC`;

const getRowNumberLogicBasedOnSorting = ({
	sorting,
}: {
	sorting: ProductSortingType;
}): ProductQueryRowNumberLogicType => {
	if (sorting === 'best-match') {
		return 'PARTITION BY p.owner';
	} else if (sorting === 'price-high-low') {
		return `ORDER BY CAST(pwd.selling_price AS DOUBLE PRECISION) DESC`;
	} else if (sorting === 'price-low-high') {
		return `ORDER BY CAST(pwd.selling_price AS DOUBLE PRECISION) ASC`;
	}
};

export const getSQLQueryForProductsWithOptions = ({
	sorting = 'best-match',
	start,
	end,
	tags: commaSeparatedTags,
	statistics,
	filters,
	productDetail = false,
	country,
}: {
	sorting?: ProductSortingType;
	start?: number;
	end?: number;
	tags?: string;
	statistics?: {
		show: boolean;
		userId: string;
	};
	filters?: {
		byOwnerId?: string;
		active?: string;
		searchOnTitle?: string;
		idList?: string[];
	};
	productDetail?: boolean;
	country: string;
}) => {
	const rowNumberLogic = getRowNumberLogicBasedOnSorting({ sorting: sorting || 'best-match' });
	let sql = `
			SELECT
			ROW_NUMBER() over ( ${rowNumberLogic}) as row_num_lvl_1,
			p.unique_id             		as "uniqueId",
			p.owner											as "owner",
			${productDetail ? `p.details#>'{media}'` : `jsonb_build_array(p.details#>'{media, 0}')`} as "media",
			p.details->>'title' 				as "title",
			${
				productDetail
					? `p.details->'description'`
					: `jsonb_build_array(jsonb_build_object('text','product', 'type', 'header'),jsonb_build_object('text',LEFT(p.details#>>'{description, 3, text}', 100), 'type', 'content') )`
			}
			as "description",
			pwd.mrp 	  as "originalPrice",
			pwd.selling_price					as "price",
			pwd.origin_country as "origin",
			jsonb_build_object(
				'description',pwd.delivery_description, 
				'fee',pwd.delivery_fee
			) as "delivery",
			p.details->'tags'				as "tags",
			merchant.details#>>'{profile,fullName}'  as "ownerName",
			merchant.details#>>'{profile,avatarUrl}'  as "avatarUrl", 
			p.details->'active' as "inStock"
			${
				statistics?.show
					? `,
			jsonb_build_object
			(
				'userReactions', 
				jsonb_build_object(
					'likesCount', 0
				),
				'currentUser', 
				jsonb_build_object(
					'liked', ${
						statistics?.userId
							? `(
							 SELECT true FROM v1.product_like_tracker plt
							 WHERE 
							 plt.product_id=p.unique_id AND 
							 plt.user_id = '${statistics.userId}' AND
							 plt.country = '${country}'
							 )`
							: false
					}
				)
			) as "statistics"
			`
					: ''
			}
			FROM v1.merchant as merchant
			INNER JOIN v1.products as p ON p.owner = merchant.unique_id
			INNER JOIN v1.country_wise_product_details as pwd ON pwd.product_id = p.unique_id
		`;

	sql += `WHERE p.verified = true AND pwd.country = '${country}' `;

	if (productDetail) {
		if (filters.idList) {
			sql += ` ${canAddOperator(sql) ? ' AND ' : ' '} p.unique_id IN (${filters.idList
				.map((i) => `'${i}'`)
				.join(',')}) `;
		}
	} else {
		const exclusiveMerchantProductsRequested = (
			exclusiveMerchants as Array<{ merchantId: string; merchantSearchTerms: Array<string> }>
		).find((item) => item.merchantId === filters?.byOwnerId);
		if (!exclusiveMerchantProductsRequested) {
			sql += ` ${canAddOperator(sql) ? ' AND ' : ' '} (p.owner) NOT IN (${exclusiveMerchants
				.map((excl) => `'${excl.merchantId}'`)
				.join(',')} ) `;
		}

		if (commaSeparatedTags) {
			sql += `${canAddOperator(sql) ? ' AND ' : ' '} (p.details->'tags') ?| array[${commaSeparatedTags
				.split(',')
				.map((tag) => `'${tag.toLowerCase()}'`)
				.join(',')}] `;
		}

		if (filters) {
			if (filters.byOwnerId) {
				sql += ` ${canAddOperator(sql) ? ' AND ' : ' '} LOWER(p.owner)=LOWER('${filters.byOwnerId}') `;
			}

			if (filters?.searchOnTitle?.trim()) {
				filters.searchOnTitle = replaceSingleTickWithDoubleTick(filters.searchOnTitle.trim().toLowerCase());
				sql += ` ${
					canAddOperator(sql) ? ' AND ' : ' '
				} UPPER(concat(p.details->>'title', merchant.details#>>'{profile,fullName}'))::text like UPPER('%${
					filters.searchOnTitle
				}%') OR p.details->'tags' ?| array['${filters.searchOnTitle.replace(/[^\w]/gi, '')}'] `;
			}

			if (filters.idList) {
				sql += ` ${canAddOperator(sql) ? ' AND ' : ' '} p.unique_id IN (${filters.idList
					.map((i) => `'${i}'`)
					.join(',')}) `;
			}
		}
	}

	sql = ` 
	SELECT *
	FROM 
	(
		SELECT ROW_NUMBER() over (ORDER BY (Select 0)) as item_row_number,
		parititioned_list.*
		FROM 
		( 
			${sql}  order by row_num_lvl_1 asc 
		) parititioned_list 
	) item_list ${start && end ? ` WHERE item_row_number BETWEEN  ${+start + 1} AND ${+end}` : ' '} `;

	if (!(start || end)) {
		sql += ` limit 100`;
	}
	return sql;
};
