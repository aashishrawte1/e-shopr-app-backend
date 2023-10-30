import { Request, Response } from 'express';
import Stripe from 'stripe';
import { getCostMapForCart, getFinalCost, getShoppingCartStructureFromItemList, getUserCountry } from '.';
import { Database } from '../../database';
import { ICartFullDetailsItem, IShoppingCart, TShortCountryCodes } from '../../models';
import {
	fetchAFile,
	getFormattedTimeForTimeZone,
	getSystemISOString,
	isUserAuthenticated,
	parseAuthorizationHeader,
} from '../../util';
import { sendResponse, Status } from '../../util/log-response.util';
import { sendEmail } from '../../util/send-email.util';
import { getCouponValueFromDB_UP, reduceQuantityOfCoupon_DB, TCouponTypes } from './coupon.controller';
import { getUserCoinsFromDB } from './get-user-coins.controller';
import { updateWallet } from './update-coin-wallet.db';
import { clearUsersCart, getUserShoppingCart } from './user-shopping-cart.controller';

type TIntentStatus = 'requires_action' | 'succeeded' | 'canceled';
type TDiscountMode = 'gems' | 'coupon';
interface IPaymentDiscount {
	mode: TDiscountMode;
	details: {
		couponCode: string;
	};
}
interface IPaymentRequest {
	stripePaymentInfo: {
		methodId?: string;
		intentId?: string;
	};
	sessionId: string;
	shippingDetails: IShippingDetails;
	discount: IPaymentDiscount;
}

export interface IShippingDetails {
	name: string;
	email: string;
	address: string;
	postalCode: string;
	phone: {
		code: number;
		number: number;
	};
}

const getCoinValue = ({ coinCount, conversionRate }: { coinCount: number; conversionRate: number }) => {
	return ((coinCount || 0) / (conversionRate || 0)).toFixed(4);
};

const getRoundDownValue = ({
	decimalPlacesCount,
	numberToConvert,
}: {
	decimalPlacesCount: number;
	numberToConvert: number;
}) => {
	return (
		Math.floor((numberToConvert + Number.EPSILON) * Math.pow(10, decimalPlacesCount)) /
		Math.pow(10, decimalPlacesCount)
	);
};

const verifyIntentStatus = (intent: Stripe.PaymentIntent) => {
	let response = {} as {
		clientSecret?: string;
		requiresAction?: boolean;
		error?: string;
		status?: TIntentStatus;
	};
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

	response.status = status as TIntentStatus;
	return response;
};

const verifyPaymentRequest = async ({
	country,
	discount,
	userId,
	shoppingCart,
}: {
	shoppingCart: IShoppingCart;
	discount: IPaymentDiscount;
	userId: string;
	country: TShortCountryCodes;
}): Promise<{
	backendCalculatedPrice: number;
	currency: string;
	dbItems: Array<ICartFullDetailsItem>;
	gemUsageInfo: { remainingGemValue: number; initialGemValue: number };
	couponDiscountInfo: { couponCode: string; couponType: TCouponTypes; couponValue: number };
	finalValueToBePaidByUser: number;
	discountValueApplied: number;
}> => {
	if (!!discount && !(discount.mode === 'gems' || discount.mode === 'coupon')) {
		throw new Error('discount object is present but mode is not recognized');
	}

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
	where p.unique_id in (${mappedItems.map((item) => `'${item.uniqueId}'`)}) AND pwd.country = '${country}';
	`;

	let dbItems = await Database.query.manyOrNone<any>(sql);

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

	const finalCostMap = await getFinalCost({ itemsMap: getShoppingCartStructureFromItemList(dbItems || []) });

	const totalPaymentWithoutDiscount = finalCostMap.total;

	let discountValueApplied = 0;
	let gemUsageInfo: { remainingGemValue: number; initialGemValue: number };
	let couponDiscountInfo: { couponCode: string; couponType: TCouponTypes; couponValue: number };
	if (discount) {
		const { mode, details } = discount;

		if (mode === 'gems') {
			const coinInfo = (await getUserCoinsFromDB({ uid: userId, country })).type1;
			const gemValue = +getCoinValue({
				coinCount: +coinInfo.count,
				conversionRate: +coinInfo.coinConversionRate,
			});
			gemUsageInfo = {
				initialGemValue: gemValue,
				remainingGemValue: gemValue,
			};

			if (totalPaymentWithoutDiscount - gemValue < 0) {
				// give full discount
				discountValueApplied = totalPaymentWithoutDiscount;
			} else {
				discountValueApplied = getRoundDownValue({
					numberToConvert: gemValue,
					decimalPlacesCount: 2,
				});
			}

			// save remaining gems.
			gemUsageInfo.remainingGemValue = +(gemValue - discountValueApplied).toFixed(4) || 0;
		} else {
			const { couponCode } = details || {};
			if (couponCode) {
				try {
					if (couponCode && couponCode.trim()) {
						const couponInfo = await getCouponValueFromDB_UP({ couponCode, country });
						if (couponInfo.discountType === '$') {
							discountValueApplied = couponInfo.couponValue;
						} else if (couponInfo.discountType === '%') {
							discountValueApplied = (couponInfo.couponValue / 100) * finalCostMap.total;
						}

						couponDiscountInfo = {
							couponValue: couponInfo.couponValue,
							couponType: couponInfo.discountType,
							couponCode: couponCode,
						};
					}
				} catch (error) {
					const res = {
						code: 500,
						error: 'Voucher not found. ',
					};
					throw new Error(JSON.stringify(res));
				}
			}
		}
	}

	let backendCalculatedPrice = +(finalCostMap.total - discountValueApplied).toFixed(2);
	let finalValueToBePaidByUser = backendCalculatedPrice > 0 ? backendCalculatedPrice : 0;
	return {
		backendCalculatedPrice,
		currency,
		dbItems,
		gemUsageInfo,
		couponDiscountInfo,
		finalValueToBePaidByUser,
		discountValueApplied,
	};
};

export const makePaymentV2Api = async (request: Request, response: Response) => {
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
	const { uid: userId } = user || {};

	if (hasError) {
		return;
	}

	const { discount, shippingDetails, stripePaymentInfo, sessionId } = request.body as IPaymentRequest;

	const { methodId: paymentMethodId, intentId: paymentIntentId } = stripePaymentInfo;
	const shoppingCart = await getUserShoppingCart({ userId, country });

	const requestVerificationResponse = await verifyPaymentRequest({
		country,
		discount,
		shoppingCart,
		userId,
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

	const {
		backendCalculatedPrice,
		currency,
		dbItems,
		gemUsageInfo,
		couponDiscountInfo,
		finalValueToBePaidByUser,
		discountValueApplied,
	} = requestVerificationResponse || {};

	if (finalValueToBePaidByUser > 0) {
		const intentRequestData: Stripe.PaymentIntentCreateParams = {
			amount: Math.round(finalValueToBePaidByUser * 100),
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
			const errorInfo = {
				stripeError: e,
				backendCalculatedPrice,
				requestBody: request.body,
				country,
				discount,
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
		const { clientSecret, status, error, requiresAction } = intentVerificationResponse || {};
		if (status !== 'succeeded') {
			sendApiRes(200, '', intentVerificationResponse);
			return;
		}
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
	}

	let orderId = Math.random().toString(36).slice(-8);

	let discountMode: TDiscountMode;
	if (gemUsageInfo) {
		discountMode = 'gems';
	} else if (couponDiscountInfo) {
		discountMode = `coupon`;
	}

	const dataToSave = {
		payment: {
			amount: finalValueToBePaidByUser.toFixed(2),
			mode: paymentIntentId === 'Full_Discount_Order' ? 'voucher' : 'card',
		},
		paymentIntentId,
		shoppingCart,
		shippingDetails,
		discount: discountValueApplied,
		discountType: discountMode,
	};

	const emailData = {
		...dataToSave,
		dbItemsList: dbItems as any,
		orderId,
		userId,
		country,
		gemUsageInfo,
		couponDiscountInfo,
	};

	clearUsersCart({ userId, country });
	sendOrderSuccessEmail_UP(emailData);

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
	await Database.query.none(sql);

	if (discountMode === 'gems') {
		await updateWallet({
			uid: userId,
			activity: {
				deviceInfo: null,
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
	} else if (dataToSave.discountType === 'coupon') {
		await reduceQuantityOfCoupon_DB({
			claimer: userId,
			voucherCode: couponDiscountInfo.couponCode,
			country,
		});
	}
	sendApiRes(200, '', {});
};

const sendOrderSuccessEmail_UP = async ({
	shoppingCart,
	shippingDetails,
	dbItemsList,
	orderId,
	discount,
	discountType,
	country,
	payment,
	couponDiscountInfo,
	gemUsageInfo,
}: {
	shoppingCart: IShoppingCart;
	shippingDetails: IShippingDetails;
	dbItemsList: ICartFullDetailsItem[];
	orderId: string;
	userId: string;
	discount: number;
	discountType: TDiscountMode;
	country: string;
	payment: {
		mode: string;
		amount: string;
	};
	couponDiscountInfo: { couponCode: string; couponValue: number; couponType: TCouponTypes };
	gemUsageInfo: { remainingGemValue: number; initialGemValue: number };
}) => {
	const countryListConfig = await fetchAFile({
		fileType: 'json',
		fileUrl:
			'https://green1sg.blob.core.windows.net/cdn/user-portal/app-data-json/uat/5.4/country-list-config.json',
	});

	const countryDetail = countryListConfig.countryList.find(
		(c) => c.isoCode.toLowerCase() === country.toLowerCase()
	);
	const currencyFormat = countryDetail.currencyFormat;

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
			${item.title}</td></tr><tr><td style='font-size: 10px'>Price : ${currencyFormat}${(+item.price).toFixed(2)}
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
			<tr> <table> <tr><span style='font-size: 14px;'>Shipping : <b> ${currencyFormat}${costMap[
			merchantEmail
		].shipping.toFixed(2)}</b></span> </tr> </table></tr>
			<tr> <table> <tr><span style='font-size: 14px;'>Subtotal : <b> ${currencyFormat}${costMap[
			merchantEmail
		].subtotal.toFixed(2)}</b></span></tr></table> </tr>
			<tr> <table> <tr> <span style='font-size: 14px;'>Order Total : <b> ${currencyFormat}${costMap[
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
		<tr> <table> <tr> <span style='font-size: 14px;'>Shipping : <b> ${currencyFormat}${finalCost.shipping.toFixed(
		2
	)}</b></span></tr> </table></tr>
		<tr><table> <tr> <span style='font-size: 14px;'>Subtotal : <b> ${currencyFormat}${finalCost.subtotal.toFixed(
		2
	)}</b></span></tr> </table></tr>

		<tr><table><tr><span style='font-size: 14px;'>
			Discount : <b> 
			-${currencyFormat}${discount.toFixed(2)} ${
		discountType ? `(${discountType === 'gems' ? discountType : `${couponDiscountInfo.couponCode}`})` : ''
	}
			</b></span></tr> </table></tr>
			<tr><table><tr> <span style='font-size: 14px;'>Order Total : <b> ${currencyFormat}${
		payment.amount
	}</b></span></tr> </table></tr>
			
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
