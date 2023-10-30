import { Request, Response } from 'express';

import { Database } from '../../database';
import { ICartFullDetailsItem, ICostBreakdown, ICostMap, IShoppingCart } from '../../models';
import { getSystemISOString, isUserAuthenticated } from '../../util';
import { sendResponse, Status } from '../../util/log-response.util';
import { getUserCountry } from './user.controller';

interface IShoppingCartLessDetailsItem {
	productId: string;
	deliveryFee: string;
	sellingPrice: string;
	count: number;
	noteToSeller: string;
}

const getCostBreakdownPerMerchant = async ({
	merchantStoreId,
	itemsMap,
}: {
	merchantStoreId: string;
	itemsMap: IShoppingCart;
}): Promise<ICostBreakdown> => {
	const costs: { shipping: number; subtotal: number; total: number } = {
		shipping: 0,
		subtotal: 0,
		total: 0,
	};

	const itemsFromMerchant = Object.keys(itemsMap[merchantStoreId]).map(
		(itemKey) => itemsMap[merchantStoreId][itemKey]
	);
	const maxShippingCost = Math.max(...itemsFromMerchant.map((item) => +item.delivery.fee));

	costs.subtotal = +itemsFromMerchant.reduce((a, b) => a + +b.price * b.count, 0).toFixed(2);
	costs.shipping = +maxShippingCost.toFixed(2);
	costs.total = +(costs.subtotal + costs.shipping).toFixed(2);

	return costs;
};

export const getShoppingCartStructureFromItemList = (items: ICartFullDetailsItem[]) => {
	// max delivery cost for products from each merchant.
	const itemsMap: {
		[key: string]: {
			[key: string]: any;
		};
	} = {};

	items.forEach((item) => {
		if (!(item.owner in itemsMap)) {
			itemsMap[item.owner] = {};
		}

		itemsMap[item.owner][item.uniqueId] = item;
	});

	return itemsMap;
};

export const getCostMapForCart = async (itemsMap: IShoppingCart): Promise<ICostMap> => {
	const costMap: ICostMap = {};

	if (!itemsMap) {
		return costMap;
	}

	for (let merchantId of Object.keys(itemsMap)) {
		costMap[merchantId] = await getCostBreakdownPerMerchant({ merchantStoreId: merchantId, itemsMap });
	}

	return costMap;
};

export const getFinalCost = async ({
	itemsMap,
	costMap,
}: {
	itemsMap: IShoppingCart;
	costMap?: ICostMap;
}) => {
	if (!costMap) {
		costMap = await getCostMapForCart(itemsMap);
	}

	return {
		subtotal: +Object.values(costMap)
			.reduce((accumulator, item) => accumulator + item.subtotal, 0)
			.toFixed(2),
		total: +Object.values(costMap)
			.reduce((accumulator, item) => accumulator + item.total, 0)
			.toFixed(2),
		shipping: +Object.values(costMap)
			.reduce((accumulator, item) => accumulator + item.shipping, 0)
			.toFixed(2),
	};
};

export const updateUsersShoppingCart = async ({
	products,
	country,
	userId,
}: {
	products: Array<IShoppingCartLessDetailsItem>;
	country: string;
	userId: string;
}) => {
	return await Database.query.task(async (task) => {
		const dbUser = await task.oneOrNone(
			`SELECT user_id FROM v1.user_shopping_cart WHERE user_id='${userId}' AND country='${country}'`
		);
		if (dbUser) {
			await task.none(`UPDATE v1.user_shopping_cart 
				SET cart_items = '${JSON.stringify(
					products
				)}',last_updated_at='${getSystemISOString()}' WHERE user_id='${userId}' AND country='${country}'`);
		} else {
			await task.none(
				`	INSERT INTO v1.user_shopping_cart (cart_items,user_id,country,last_updated_at) VALUES ('${JSON.stringify(
					products
				)}', '${userId}','${country}','${getSystemISOString()}')`
			);
		}
	});
};

export const getCartItems = async ({
	userId,
	country,
}: {
	userId: string;
	country: string;
}): Promise<Array<IShoppingCartLessDetailsItem>> => {
	const sql = `
		SELECT 
			u.cart_items AS "cartItems"
			FROM v1.user_shopping_cart AS u 
			WHERE u.user_id='${userId}' AND 
			country='${country}'
		`;
	return (await Database.query.oneOrNone<{ cartItems: Array<IShoppingCartLessDetailsItem> }>(sql))?.cartItems;
};

export const updateCartApi_UP = async (request: Request, response: Response) => {
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
	const country = await getUserCountry({ authorizationKeyValMap });
	let { cartItems } = request.body as {
		cartItems: Array<{ productId: string; count: number; noteToSeller: string }>;
	};

	if (!(cartItems && cartItems.length)) {
		cartItems = [];
	}

	const { uid: userId = null } = authorizationKeyValMap || {};

	const productIDCommaSeparated = cartItems.map(({ productId }) => `'${productId}'`).join(',');
	const cartProductsSQL = `
		SELECT
			pwd.product_id as "productId", 
			pwd.selling_price as "sellingPrice", 
			pwd.delivery_fee as "deliveryFee"
			FROM v1.country_wise_product_details pwd
			WHERE pwd.product_id IN (${productIDCommaSeparated}) AND 
			pwd.country = '${country}';
	`;
	let products = [];
	if (productIDCommaSeparated) {
		products = await Database.query.many<IShoppingCartLessDetailsItem>(cartProductsSQL);
	}
	products = products.map((p) => {
		const cartProductInfo = cartItems.find((c) => c.productId === p.productId);
		return {
			...p,
			count: cartProductInfo.count,
			noteToSeller: cartProductInfo.noteToSeller,
		};
	});

	await updateUsersShoppingCart({
		products,
		userId,
		country,
	}).catch((e) => {
		console.error(`DB Error: ${updateUsersShoppingCart.name}`, e);
		sendApiRes(400, `DB Error during shopping cart update`);
	});

	if (hasError) {
		return;
	}
	sendApiRes(200, '');
};

export const getUserCartItemApi_UP = async (request: Request, response: Response) => {
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

	const { uid: userId = null } = authorizationKeyValMap || {};
	const country = await getUserCountry({ authorizationKeyValMap });
	const shoppingCart = await getUserShoppingCart({ userId, country }).catch((error) => {
		console.error('could not get users cart', error);
		sendApiRes(400, 'could not get users cart');
	});
	if (hasError) {
		return;
	}

	sendApiRes(200, '', shoppingCart);
};

export const getUserShoppingCart = async ({
	userId,
	country,
}: {
	userId: string;
	country: string;
}): Promise<IShoppingCart> => {
	let cartItems = await getCartItems({
		userId,
		country,
	});

	const productIDCommaSeparated = (cartItems || []).map(({ productId }) => `'${productId}'`).join(',');
	if (!productIDCommaSeparated) {
		return;
	}
	const cartItemsSQL = `
	SELECT
		p.unique_id             		as "uniqueId",
		p.owner											as "owner",
		jsonb_build_array(p.details#>'{media, 0}') as "media",
		p.details->>'title' 				as "title",
		jsonb_build_array(
			jsonb_build_object('text','product', 'type', 'header'),
			jsonb_build_object('text',LEFT(p.details#>>'{description, 3, text}', 100), 'type', 'content') 
		) as "description",
		pwd.mrp 	  as "originalPrice",
		pwd.selling_price					as "price",
		jsonb_build_object(
			'description',pwd.delivery_description,
			'fee',pwd.delivery_fee
		) as "delivery",
		merchant.details#>>'{profile,fullName}'  as "ownerName",
		merchant.details#>>'{profile,avatarUrl}'  as "avatarUrl"
	FROM v1.merchant as merchant
	INNER JOIN v1.products as p ON p.owner = merchant.unique_id
	INNER JOIN v1.country_wise_product_details as pwd ON pwd.product_id = p.unique_id
	WHERE
	p.unique_id in (${productIDCommaSeparated}) AND 
	pwd.country = '${country}'
	`;

	let cartItemDetails = await Database.query.manyOrNone(cartItemsSQL);
	cartItemDetails = cartItemDetails.map((cid) => ({
		...cid,
		count: (cartItems || []).find((ci) => ci.productId === cid.uniqueId).count,
		noteToSeller: (cartItems || []).find((ci) => ci.productId === cid.uniqueId).noteToSeller,
	}));

	return getShoppingCartStructureFromItemList(cartItemDetails);
};

export const clearUsersCart = async ({ userId, country }: { userId: string; country: string }) => {
	const sql = `
		UPDATE
		v1.user_shopping_cart
		SET
		cart_items = null, 
		last_updated_at = now()
		WHERE
		user_id = '${userId}' AND
		country = '${country}'
	`;
	return await Database.query.none(sql);
};
