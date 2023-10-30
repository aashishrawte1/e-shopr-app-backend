import { Request, Response } from 'express';
import Stripe from 'stripe';
import { getCostMapForCart, getFinalCost, getShoppingCartStructureFromItemList, getUserCountry } from '.';
import { Database } from '../../database';
import { ICartFullDetailsItem, IShoppingCart, TShortCountryCodes } from '../../models';
import {
	getFormattedTimeForTimeZone,
	getSystemISOString,
	isUserAuthenticated,
	parseAuthorizationHeader,
} from '../../util';
import { sendResponse, Status } from '../../util/log-response.util';
import { sendEmail } from '../../util/send-email.util';
import { getCouponValueFromDB_UP, reduceQuantityOfCoupon_DB } from './coupon.controller';
import { getUserCoinsFromDB } from './get-user-coins.controller';
import { updateWallet } from './update-coin-wallet.db';
import { clearUsersCart, getUserShoppingCart } from './user-shopping-cart.controller';
// DONT TOUCH EXISTING
const verifyIntentStatus = (intent: Stripe.PaymentIntent) => {
	let response: any = {};
	const { status } = intent;
	// Generate a response based on the intent's status
	if (status === 'requires_action') {
		response = {
			requiresAction: true,
			clientSecret: intent.client_secret,
		};
	} else if (status === 'succeeded') {
		response = { clientSecret: intent.client_secret };
	} else if (status === 'requires_payment_method') {
		response = {
			error:
				'Your card was denied, please provide a new payment method. If this problem persist, <a href="mailto:admin@grendayapp.com">Contact us</a>',
		};
	} else if (status === 'canceled') {
		response = {
			error: 'You payment was cancelled.',
		};
	}
	return response;
};

const verifyPaymentRequest = async ({
	requestBody: data,
	userId: uid,
	country,
}: {
	requestBody: any;
	userId: string;
	country: TShortCountryCodes;
}) => {
	const { shoppingCart, couponCode, discountValueApplied } = data;
	const mappedItems = [];
	Object.values(shoppingCart).forEach((value) => mappedItems.push(...Object.values(value)));
	let currency: string;
	if (country === 'sg') {
		currency = 'sgd';
	} else if (country === 'my') {
		currency = 'myr';
	}

	const sql = `
	SELECT 
	p.unique_id             		as "uniqueId",
	p.owner											as "owner",
	pwd.selling_price						as "price",
	jsonb_build_object( 
				'fee',pwd.delivery_fee
			) as "delivery",
	p.details->'active'				as "inStock"
	FROM v1.products as p 
	INNER JOIN v1.country_wise_product_details as pwd ON pwd.product_id = p.unique_id
	where p.unique_id in (${mappedItems.map((item) => `'${item.uniqueId}'`)}) AND pwd.country = '${country}'
	`;

	let dbItems: any[];

	try {
		dbItems = await Database.query.manyOrNone<any>(sql);
	} catch (error) {
		const res = {
			code: 500,
			error,
		};
	}

	try {
		dbItems = (dbItems || []).map((dbItem) => ({
			...dbItem,
			count: mappedItems.find((item) => item.uniqueId === dbItem.uniqueId).count,
		}));
	} catch (error) {
		const res = {
			code: 500,
			error,
		};
		throw new Error(JSON.stringify(res));
	}

	const outOfStockItems = dbItems.filter((di) => !di.inStock);
	if (outOfStockItems.length > 0) {
		const res = {
			code: 'OUT_OF_STOCK_ERROR',
			error:
				'One ore more item, in your basket has just gone out of of stock. We will proceed to remove them.',
			outOfStockItems,
		};
		throw new Error(JSON.stringify(res));
	}
	let subtotal = (await getFinalCost({ itemsMap: getShoppingCartStructureFromItemList(dbItems || []) }))
		.subtotal;
	let shippingPrice = (await getFinalCost({ itemsMap: getShoppingCartStructureFromItemList(dbItems || []) }))
		.shipping;
	let backendCalculatedPrice = +(subtotal + shippingPrice).toFixed(2);
	let displayedPrice = (await getFinalCost({ itemsMap: shoppingCart })).total;
	if (backendCalculatedPrice !== displayedPrice) {
		const res = {
			code: 500,
			error: 'price mismatch error',
		};
		throw new Error(JSON.stringify(res));
	}

	let discount: { couponValue: number; discountType: string } = { couponValue: 0, discountType: '' };

	try {
		if (couponCode && couponCode.trim()) {
			discount = (await getCouponValueFromDB_UP({ couponCode, country })) as any;
		}
	} catch (error) {
		const res = {
			code: 500,
			error: 'Voucher not found. ',
		};
		throw new Error(JSON.stringify(res));
	}

	if (discount.couponValue > 0 && +discountValueApplied > 0) {
		const res = {
			code: 'ONLY_ONE_TYPE_OF_DISCOUNT_ALLOWED',
			error: 'Gems can not be used with voucher.',
		};
		throw new Error(JSON.stringify(res));
	}

	if (discountValueApplied) {
		const userCoinInfo = await getUserCoinsFromDB({ uid, country });
		const coinValue = userCoinInfo.type1.value;

		if (discountValueApplied > coinValue) {
			const res = {
				code: 'DISCOUNT_VALUE_GREATER_THAN_AVAILABLE_BALANCE',
				error:
					'Something went wrong. Actual Gem value in our record is lesser than what you are trying to apply. Please contact GreenDay.',
			};
			throw new Error(JSON.stringify(res));
		}

		discount = { couponValue: discountValueApplied, discountType: 'gems' };
	}
	// round up the price to two decimal.
	if (!discount.discountType) {
		backendCalculatedPrice -= discount?.couponValue || 0;
		// if after discount amount goes negative, set the amount to zero
		backendCalculatedPrice = backendCalculatedPrice < 0 ? 0 : backendCalculatedPrice;
		backendCalculatedPrice = +backendCalculatedPrice.toFixed(2);
	} else if (discount.discountType === '$') {
		backendCalculatedPrice -= discount?.couponValue || 0;
		// if after discount amount goes negative, set the amount to zero
		backendCalculatedPrice = backendCalculatedPrice < 0 ? 0 : backendCalculatedPrice;
		backendCalculatedPrice = +backendCalculatedPrice.toFixed(2);
	} else if (discount.discountType === '%') {
		const discountPrice = (+discount?.couponValue / 100) * +subtotal;
		backendCalculatedPrice -= discountPrice || 0;
		// if after discount amount goes negative, set the amount to zero
		backendCalculatedPrice = +backendCalculatedPrice < 0 ? 0 : +backendCalculatedPrice;
		backendCalculatedPrice = +backendCalculatedPrice.toFixed(2);
	}
	return {
		backendCalculatedPrice,
		currency,
		dbItems,
		discount,
	};
};

export const makePaymentApi_UP = async (request: Request, response: Response) => {
	let hasError = false;
	function sendApiRes(code: any, description: string, result?: any) {
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
	const uid = user && user.uid;

	if (hasError) {
		return;
	}
	const { paymentMethodId, paymentIntentId, couponCode } = request.body;
	const shoppingCart = await getUserShoppingCart({ userId: uid, country });
	const requestVerificationResponse = await verifyPaymentRequest({
		requestBody: request.body,
		userId: uid,
		country,
	}).catch((error) => {
		const errorRes = JSON.parse(error.message);

		sendApiRes(
			errorRes?.code || 500,
			errorRes.error,
			errorRes.code === 'OUT_OF_STOCK_ERROR' ? errorRes.outOfStockItems : null
		);

		sendEmail({
			to: process.env.DEBUGGER_EMAIL,
			bcc: 'admin@grendayapp.com',
			message: error.message,
			subject: 'payment_error: dont',
		});
	});

	if (hasError) {
		return;
	}

	const { backendCalculatedPrice, currency } = requestVerificationResponse || {};
	const intentRequestData: Stripe.PaymentIntentCreateParams = {
		amount: Math.round(backendCalculatedPrice * 100),
		currency: currency,
		// eslint-disable-next-line @typescript-eslint/camelcase
		payment_method: paymentMethodId,
		// eslint-disable-next-line @typescript-eslint/camelcase
		confirmation_method: 'manual',
		confirm: true,
	};

	let intent: any;
	try {
		const stripe = new Stripe(process.env.STRIPE_SECRET, {
			apiVersion: '2020-08-27',
		});
		if (paymentMethodId) {
			// Create new PaymentIntent with a PaymentMethod ID from the client.
			intent = await stripe.paymentIntents.create(intentRequestData);
			// After create, if the PaymentIntent's status is succeeded, fulfill the order.
		} else if (paymentIntentId) {
			// Confirm the PaymentIntent to finalize payment after handling a required action
			// on the client.
			intent = await stripe.paymentIntents.confirm(paymentIntentId);
			// After confirm, if the PaymentIntent's status is succeeded, fulfill the order.
		}
	} catch (e) {
		const { originalBackendCalculatedPrice } = requestVerificationResponse as any;
		const errorInfo = {
			stripeError: e,
			requestBody: request.body,
			originalBackendCalculatedPrice,
			backendCalculatedPrice,
			couponCode,
			paymentMethodId,
			paymentIntentId,
			shoppingCart,
		};
		console.error('paymentError', { errorInfo });
		sendEmail({
			to: process.env.DEBUGGER_EMAIL,
			cc: process.env.DEBUGGER_EMAIL,
			message: `${JSON.stringify(errorInfo)}`,
			subject: 'Payment failure. Let Mr. Kumar know about it please...',
		});

		sendApiRes(
			500,
			'Something went wrong. Be rest assured you have not been charged. <a href="mailto:admin@grendayapp.com">contact us</a>'
		);
	}

	if (hasError) {
		return;
	}

	const intentVerificationResponse = verifyIntentStatus(intent);
	const { error } = intentVerificationResponse;

	if (error) {
		sendEmail({
			to: process.env.DEBUGGER_EMAIL,
			bcc: 'admin@grendayapp.com',
			message: JSON.stringify(error),
			subject: 'payment_error: dont',
		});
		sendApiRes(203, error);
		return;
	}

	if (hasError) {
		return;
	}

	sendApiRes(200, '', intentVerificationResponse);
};

export const saveOrderApi_UP = async (request: Request, response: Response) => {
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
		const { code } = err;
		sendApiRes(code, 'You must be logged in to continue...');
	});
	const authorizationKeyValMap = parseAuthorizationHeader(request);
	const country = await getUserCountry({ authorizationKeyValMap });
	const { uid: userId } = user || {};

	const requestVerificationResponse = await verifyPaymentRequest({
		requestBody: request.body,
		userId,
		country,
	}).catch((error) => {
		const errorRes = JSON.parse(error);
		sendApiRes(errorRes?.code || 500, 'Something went wrong...');
	});
	if (hasError) {
		return;
	}

	let { backendCalculatedPrice, dbItems, discount } = requestVerificationResponse || {};

	const { shippingDetails, couponCode } = request.body;
	let { paymentIntentId, sessionId, deviceInfo } = request.body;
	const shoppingCart = await getUserShoppingCart({ userId, country });

	let orderId = Math.random().toString(36).slice(-8);

	let typeOfDiscount = '';
	if (couponCode) {
		typeOfDiscount = 'voucher';
	} else if (discount.couponValue > 0) {
		typeOfDiscount = 'coins';
	}
	const dataToSave = {
		payment: {
			amount: backendCalculatedPrice.toFixed(2),
			mode: paymentIntentId === 'Full_Discount_Order' ? 'voucher' : 'card',
		},
		paymentIntentId,
		shoppingCart,
		shippingDetails,
		discount: discount.couponValue,
		discountType: discount.discountType,
		typeOfDiscount,
	};

	const emailData = {
		...dataToSave,
		dbItemsList: dbItems as any,
		orderId,
		userId,
		country,
	};

	clearUsersCart({ userId, country });
	sendOrderSuccessEmail_UP(emailData);

	if (!paymentIntentId && backendCalculatedPrice === 0) {
		paymentIntentId = 'Full_Discount_Order';
	}

	const sql = `INSERT INTO v1.orders (
    unique_id,
    ordered_by,
    ordered_at,
		details,
		order_referenceId,
		country
  ) VALUES (
    v1.id_generator(),
    '${userId}',
    '${getSystemISOString()}',
		'${JSON.stringify(dataToSave).replace(/'/g, '')}','${orderId}',
		'${country}'
  )`;
	let dbRes = await Database.query.none(sql).catch((e) => {
		console.error(`DB Error: ${saveOrderApi_UP.name}`, e);
		sendApiRes(500, 'save order failed');
	});

	if (hasError) {
		return;
	}

	if (dataToSave.typeOfDiscount === 'coins') {
		await updateWallet({
			uid: user && user.uid,
			activity: {
				deviceInfo,
				data: {
					valueUsed: dataToSave.discount,
					discountType: dataToSave.discountType,
					orderId,
				},
				sessionId,
				actionType: 'gem_used_for_purchase',
			},
			country,
		});
	} else if (dataToSave.typeOfDiscount === 'voucher') {
		await reduceQuantityOfCoupon_DB({ claimer: user && user.uid, voucherCode: couponCode, country });
	}
	sendApiRes(200, '', dbRes);
};

export const sendOrderSuccessEmail_UP = async ({
	shoppingCart,
	shippingDetails,
	dbItemsList,
	orderId,
	userId,
	discount,
	discountType,
	country,
}: {
	shoppingCart: IShoppingCart;
	shippingDetails: any;
	dbItemsList: ICartFullDetailsItem[];
	orderId: string;
	userId: string;
	discount: number;
	discountType: string;
	country: string;
}) => {
	const orderNumber = orderId.toUpperCase();
	const placedOn = getFormattedTimeForTimeZone();
	const dbItemsMap = getShoppingCartStructureFromItemList(dbItemsList);
	const costMap = await getCostMapForCart(dbItemsMap);

	let topEmailBody = `
	<html>
		<body>
		<table> 
		<tr> 
			<td>
`;

	let customerMessage =
		topEmailBody +
		`<table> 
					<tr> 
						<td style='font-size: 12px;font-weight: bold;'>
						Thank you for your order from <span style='font-size:14px;color:#09aa7a;'>GreenDay</span>.</td> 
					</tr> 
					<tr> <td style='font-size: 10px'>Placed on : ${placedOn}
			</td> </tr> </table> </td> </tr> </table>

	</table><tr><p><b><u>Your Order Summary</u></b></p></tr><tr> <td style='font-size: 10px'>Placed on : 
		${placedOn}</td> </tr> </table> </td> </tr> </table>`;

	const sendEmailPromiseList = [];

	let customerShippingAddressInfo = '';
	for (let merchantEmail in shoppingCart) {
		let sellerMessage =
			topEmailBody +
			`
		<table><tr><td> <table> <tr> <td style='font-size: 12px;font-weight: bold;'>
		You got an order. Please prepare for delivery.
		</td> </tr> <tr> <td></td> </tr> <tr> 
		<td style='font-size: 12px;font-weight: bold;margin-top:10px;'>
		Order Placed On : ${placedOn}</td> </tr></table> </td> </tr> </table>`;

		const orderDetails = `${Object.values(shoppingCart[merchantEmail])
			.map((item) => {
				return `
			<table><tr><b>
		<tr><td><div style='height: 80px; width: 85px;background-repeat: no-repeat;display: block; background: url("${
			item.media[0].link
		}"); background-size: contain;'></div></td><td><table><tr><td style='font-size: 12px;font-weight: bold;'>
			${item.title}</td></tr><tr><td style='font-size: 10px'>Price : ${
					country === 'sg' ? 'S$' : 'RM'
				}${(+item.price).toFixed(2)}
			</td></tr><tr><td style='font-size: 10px'>Quantity : ${
				item.count
			} </td></tr><tr><td style='font-size: 8px;font-style: italic;'>Seller : 
			${item.ownerName} </td></tr><tr><td style='font-size: 8px;font-style: italic;'>Delivery : ${
					item.delivery.description
				}</td></tr></table></td></tr>
				</table>

				<table> <tr> <b>Important note from customer: </b> </tr> <tr> <td> <table> <tr> <td><span style='font-size: 12px;'> ${
					item.noteToSeller
				}</span></td> </tr> </table> </td> </tr> </table>
			`;
			})
			.join('')}`;
		customerMessage += orderDetails;
		sellerMessage += orderDetails;
		customerShippingAddressInfo = `<br> <table> <tr> <b>Delivery address: </b> </tr> <tr> <td> <table> <tr> <td style='font-size: 12px;font-weight: bold;'>
		${shippingDetails.name}</td> </tr> <tr> <td style='font-size: 10px'>${shippingDetails.address}, ${
			country === 'sg' ? 'Singapore' : 'Malaysia'
		}</td> </tr> <tr> <td style='font-size:10px'>
			${shippingDetails.postalCode}</td> </tr> </table> </td> </tr> </table>
			<br> <table> <tr> <b>Customer contact details: </b> </tr> <tr> <td> <table> <tr> <td style='font-size: 12px;font-weight: bold;'>
				${shippingDetails.email} </td> </tr> <tr> <td style='font-size: 10px'> +${shippingDetails.phone.code}-${
			shippingDetails.phone.number
		}</td> </tr> </table> </td> </tr> </table>
			<br> `;
		sellerMessage += customerShippingAddressInfo;
		const paymentInfo = `
		<table> <tr> <b>Payment: </b> </tr>
			<tr> <table> <tr><span style='font-size: 14px;'>Shipping : <b> ${country === 'sg' ? 'S$' : 'RM'}${costMap[
			merchantEmail
		].shipping.toFixed(2)}</b></span> </tr> </table></tr>
			<tr> <table> <tr><span style='font-size: 14px;'>Subtotal : <b> ${country === 'sg' ? 'S$' : 'RM'}${costMap[
			merchantEmail
		].subtotal.toFixed(2)}</b></span></tr></table> </tr>
			<tr> <table> <tr> <span style='font-size: 14px;'>Order Total : <b> ${country === 'sg' ? 'S$' : 'RM'}${costMap[
			merchantEmail
		].total.toFixed(2)}</b></span></tr> </table> </tr>
		</table> 
		</body></html>
		`;
		sellerMessage += paymentInfo;

		sendEmailPromiseList.push(
			sendEmail({
				to: merchantEmail,
				bcc: 'admin@grendayapp.com',
				message: sellerMessage,
				subject: '📦 Order received #' + orderNumber,
			}).catch((e) => {
				console.error(`Send Email Error: ${sendOrderSuccessEmail_UP.name}`, e);
			})
		);
	}

	const finalCost = await getFinalCost({ itemsMap: getShoppingCartStructureFromItemList(dbItemsList || []) });
	const paymentInfo = `
		<table> <tr> <b>Payment: </b> </tr> 
		<tr> <table> <tr> <span style='font-size: 14px;'>Shipping : <b> ${
			country === 'sg' ? 'S$' : 'RM'
		}${finalCost.shipping.toFixed(2)}</b></span></tr> </table></tr>
		<tr><table> <tr> <span style='font-size: 14px;'>Subtotal : <b> ${
			country === 'sg' ? 'S$' : 'RM'
		}${finalCost.subtotal.toFixed(2)}</b></span></tr> </table></tr>

		<tr><table><tr><span style='font-size: 14px;'>
			Discount : <b> 
			-${country === 'sg' ? 'S$' : 'RM'}${(
		await getDiscountPrice(discountType, discount, finalCost.subtotal)
	).toFixed(2)}${discountType ? `(${discountType})` : ''}
			</b></span></tr> </table></tr>
			<tr><table><tr> <span style='font-size: 14px;'>Order Total : <b> ${country === 'sg' ? 'S$' : 'RM'}${await (
		await getTotalPrice(discountType, discount, finalCost.subtotal, finalCost.shipping)
	).toFixed(2)}</b></span></tr> </table></tr>
			
			</table></tr> 
			</table> </body></html>
		`;
	customerMessage += customerShippingAddressInfo;
	customerMessage += paymentInfo;
	sendEmailPromiseList.push(
		sendEmail({
			to: shippingDetails.email,
			bcc: 'admin@grendayapp.com',
			message: customerMessage,
			subject: '📦 Order successful #' + orderNumber,
		})
	);

	Promise.resolve(sendEmailPromiseList)
		.then((res) => {
			console.log('order email send successful', res);
		})
		.catch((error) => {
			console.error('email sending error', { error });
		});
};

export const getDiscountPrice = async (discountType: string, discount: number, subtotal: number) => {
	let discountPrice = 0;
	if (discountType === '$' || !discountType) {
		discountPrice = +discount.toFixed(2);
	} else if (discountType === '%') {
		const totalDiscount = +(discount / 100) * +subtotal;
		discountPrice = +totalDiscount.toFixed(2);
	} else if (!discount) {
		discountPrice = 0;
	}
	return discountPrice;
};

export const getTotalPrice = async (
	discountType: string,
	discount: number,
	subtotal: number,
	shipping: number
) => {
	let totalPrice = 0;
	if (discountType === '$' || !discountType) {
		totalPrice = +(subtotal + +shipping - +discount).toFixed(2);
	} else if (discountType === '%') {
		const totalDiscount = +(discount / 100) * +subtotal;
		totalPrice = +(subtotal + +shipping - +totalDiscount).toFixed(2);
	} else if (discount < +(subtotal + +shipping)) {
		totalPrice = 0;
	}
	return totalPrice;
};
