import express from 'express';
import { makeCORSRequest } from './controllers/general';
import {
	addArticleToDb_Api,
	addProfilePictureApi_MP,
	addRemarkApi_MP,
	createNewMerchantApi_MP,
	getAllProductsApi_MP,
	getAllRegistrationToken_MP,
	getAllUsersApi_MP,
	getDeviceList_MP,
	getMerchantListApi_MP,
	getMerchantProfileApi_MP,
	getOrdersApi_MP,
	getRegistrationToken_MP,
	massEmailUsersAPI_MP,
	notificationLogDB_MP,
	reorderProductImageApi_MP,
	sendNotificationToAllUsers_API,
} from './controllers/management-portal';
import {
	addUserApi_UP,
	barteringDeleteProductApi,
	barteringGetAllProductsApi,
	barteringGetMatchesApi,
	barteringGetProductDetailApi,
	barteringGetProductDetailWithRelevanceApi,
	barteringGetRelevantProductsApi,
	barteringLikeProductApi,
	barteringModifyProductApi,
	barteringPostMessageApi,
	checkReferralCodeValidity_API,
	contactUsApi_UP,
	getArticles_API,
	getCategoriesInPopularityOrder_API,
	getCoinActionListApi_UP,
	getCoinsForUser_Api,
	getCouponDetailsByCouponCode_API,
	getDataForSpinTheWheelApi_UP,
	getForageItems_API,
	getJustForYouProducts_API,
	getLatestSiteDeploymentInfo_API,
	getLikedProductsForUser_API,
	getLoginProviderAPI_UP,
	getMerchantListApi_UP,
	getOrderListForUserApi,
	getPopularProductsApi_UP,
	getProductDetailApi_UP,
	getProductsByOwnerApi_UP,
	getProductsByPagination_API,
	getProductsBySearchTermApi_UP,
	getReferralCodeApi_UP,
	getRelatedProducts_API,
	getShippingAddressApi_UP,
	getTurtlePicks_API,
	getUserCartItemApi_UP,
	getUserProfileApi_UP,
	getUserRegistrationQuizResponseStatus_API,
	getUserStatForPAWave2020_API,
	getUserStatForKKEvent2021_API,
	makePaymentApi_UP,
	makePaymentV2Api,
	reduceQuantityOfCoupon_DB,
	saveDeviceInfo_API,
	saveOrderApi_UP,
	saveProductShareActivity_API,
	saveRegistrationWelcomeQuizResponse_API,
	saveUserCoinActivity_API,
	sendEmailForGreenConciergeChat_API,
	unsubscribeFromMailingList_API,
	updateCartApi_UP,
	updateNotificationStatusAPI,
	updateProductLike_API,
	updateProfilePictureApi_UP,
	updateShippingAddressApi_UP,
	updateUserAnalyticsListApi_UP,
	updateUserContactApi_UP,
	updateUserCountryApi_UP,
	updateUserEmailApi_UP,
	updateUserFullNameApi_UP,
	updateUserLastLoginApi_UP,
} from './controllers/user-portal';
import {
	getTeamStatForPWAEvent2021_API,
	getTop10TeamStatForPWAEvent2021_API,
	getUserStatForPWAEvent2021_API,
} from './controllers/user-portal/passion-wave/pa-wave-2020.controller';

export const generalEndpoints = {
	// File Get
	makeCorsRequest: '/get/file',
};
export const mpEndpoints = {
	addLinkToDb: '/post/article-link',
	addNewUser: '/post/merchant-add-new-user',
	addProfilePicture: '/post/merchant-add-profile-picture',
	addRemark: '/post/merchant-add-remark',
	updateProductTags: '/post/merchant-update-tags',
	reorderProductImages: '/post/merchant-reorder-product-image',
	getMerchantProfile: '/get/merchant-getData',
	getUserList: '/get/merchant-get-users',
	getOrders: '/get/merchant-get-orders',
	getProducts: '/get/merchant-get-products',
	getMerchantList: '/get/merchant-get-all-merchants',
	getDeviceList: '/get/merchant-get-all-device',
	addNotificationLog: '/post/merchant-add-notification',
	getRegistrationToken: '/get/registration-token',
	getAllRegistrationToken: '/get/all-registration-token',
	sendEmailToUser: '/post/email-to-users',
	sendNotificationToAllUsers: '/post/notification-to-all-users',
};

export const userEndpoints = {
	// User
	getUserProfile: '/get/user',
	addUserToDB: '/post/create-new-user',
	updateProfilePicture: '/post/profile-picture',
	updateUserContact: '/post/phone',
	updateUserFullName: '/post/name',
	updateUserEmail: '/post/email',
	updateUserCountry: '/post/update-user-country',
	updateUserLastLogin: '/post/update-last-login',
	getLoginProvider: '/post/login-provider',
	postUserQueryToAdminThroughGreenConcierge: '/post/user-query-green-concierge',
	postRegistrationWelcomeQuizResponse: '/post/registration-welcome-quiz-response',
	getUserRegistrationQuizResponseStatus: '/get/user-registration-quiz-response-status',

	// PRODUCT REQUESTS
	getPopularProducts: '/get/popular-products',
	getProducts: '/get/products',
	getProductsByOwner: '/get/products-by-owner',
	getProductDetail: '/get/product',
	getJustForYouProducts: '/get/just-for-you',
	getForageItems: '/get/forage-items',
	getRelatedProducts: '/get/related-products',

	// ARTICLE REQUEST
	getArticles: '/get/articles',
	getArticleDetails: '/get/article-detail',

	// Miscellaneous
	homePageProductItems_UP: '/get/home',
	sendQuizResponse: '/post/quiz',
	getQuiz: '/get/quiz',
	contactUs: '/post/contact-us',
	getAppShareLinks: '/get/app-store',
	getActiveBanners: '/get/banner',
	getCouponCode: '/get/coupon-code',
	saveCoupon: '/post/coupon',
	saveNotificationToken: '/post/save-notification-token',
	getCrazyVideo: '/get/crazy-video',
	getPlaygroundList: '/get/play-ground-list',
	getWheelSegment: '/get/wheel-segment',

	// Payment related
	makePayment: '/post/payment',
	makePaymentVersion2: '/post/payment-v2',
	saveOrder: '/post/save-order',
	getShippingAddress: '/get/shipping',
	updateShippingAddress: '/post/shipping',

	// Order Related
	getOrderListForUser: '/get/my-orders',

	// CART
	getCartItems: '/get/cart-items',
	updateCartItems: '/post/cart-items',

	// MISCELLANEOUS
	getPopularTagsList: '/get/tags',
	getDataFilteredByTags: '/get/data-filter-by-tags',
	getProductBySearchTerm: '/get/products-filtered-by-search',

	// Notification
	updateNotificationStatus: '/post/update-notification-status',
	getNotificationData: '/get/notification-data',
	addNotificationDB: '/post/user-add-notification',
	getReferrerNotificationDetail: '/get/user-notification-detail',

	// Merchant Related
	getMerchantList: '/get/merchant-list',

	createQuiz: '/post/create-quiz',

	// Coin Activity
	getUserCoins: '/get/user-coins',
	getCoinActionList: '/get/coin-action-list',
	updateUserCoinActivityList: '/post/user-coin-activity-list',

	// Analytics
	updateUserAnalytics: '/post/user-analytics-list',

	// Referral System
	getReferralCode: '/get/user-referral-code',
	checkReferralCodeValidity: '/get/check-referral-code-validity',

	// EMAIL
	unsubscribeFromMailingList: '/get/unsubscribe-from-mailing-list',

	// Like
	saveMyLikProducts: '/post/save-user-like-products',
	getMyLikeProductList: '/get/my-like-product-list',

	setProductLikeStatus: '/post/set-user-like',
	getTurtlePicks: '/get/turtle-picks',

	//Share
	saveShareProduct: '/post/save-share-products',

	// site-deployments
	getLatestSiteDeployment: '/get/latest-site-deployment-info',

	// Bartering
	barteringModifyProduct: '/post/bartering-modify-product',
	barteringDeleteProduct: '/delete/bartering-delete-product',
	barteringLikeProduct: '/post/bartering-like-product',
	barteringIgnoreProduct: '/post/bartering-ignore-product',
	barteringGetAllProductsAddedByCurrentUser: '/get/bartering-get-all-products-added-by-current-user',
	barteringGetRelevantProducts: '/get/bartering-get-relevant-products',
	barteringGetMatches: '/get/bartering-get-matches',
	barteringGetProductDetailWithRelevance: '/get/bartering-get-product-detail-with-relevance',
	barteringGetProductDetail: '/get/bartering-get-product-detail',
	barteringChat: '/post/bartering-chat-message',
	// PA-WAVE
	getUserStatForPAWave2020: '/get/user-stat-pa-wave-2020',
	//kk event
	getUserStatForKKEvent2021: '/get/user-stat-kk-event-2021',
	//pwa event 2021
	getUserStatForPWAEvent2021: '/get/user-stat-pwa-event-2021',
	getTeamStatForPWAEvent2021: '/get/team-stat-pwa-event-2021',
	getTop10TeamStatForPWAEvent20: '/get/top10team-stat-pwa-event-2021',
};

const router = express();

//event pwa 2021
router.get(userEndpoints.getUserStatForPWAEvent2021, getUserStatForPWAEvent2021_API);
router.get(userEndpoints.getTeamStatForPWAEvent2021, getTeamStatForPWAEvent2021_API);
router.get(userEndpoints.getTop10TeamStatForPWAEvent20, getTop10TeamStatForPWAEvent2021_API);

// user-management
router.post(userEndpoints.addUserToDB, addUserApi_UP);
router.post(userEndpoints.updateProfilePicture, updateProfilePictureApi_UP);
router.get(userEndpoints.getUserProfile, getUserProfileApi_UP);
router.get(userEndpoints.getCouponCode, getCouponDetailsByCouponCode_API);
router.post(userEndpoints.saveCoupon, reduceQuantityOfCoupon_DB);
router.post(userEndpoints.updateNotificationStatus, updateNotificationStatusAPI);
router.post(userEndpoints.updateUserContact, updateUserContactApi_UP);
router.post(userEndpoints.updateUserFullName, updateUserFullNameApi_UP);
router.post(userEndpoints.updateUserEmail, updateUserEmailApi_UP);
router.post(userEndpoints.updateUserCountry, updateUserCountryApi_UP);
router.post(userEndpoints.updateUserLastLogin, updateUserLastLoginApi_UP);
router.post(userEndpoints.contactUs, contactUsApi_UP);
router.post(userEndpoints.getLoginProvider, getLoginProviderAPI_UP);
router.post(userEndpoints.postUserQueryToAdminThroughGreenConcierge, sendEmailForGreenConciergeChat_API);
router.get(userEndpoints.unsubscribeFromMailingList, unsubscribeFromMailingList_API);
router.post(userEndpoints.postRegistrationWelcomeQuizResponse, saveRegistrationWelcomeQuizResponse_API);
router.get(userEndpoints.getUserRegistrationQuizResponseStatus, getUserRegistrationQuizResponseStatus_API);
router.get(userEndpoints.getJustForYouProducts, getJustForYouProducts_API);

// Likes Related
router.post(userEndpoints.saveMyLikProducts, updateProductLike_API);
router.get(userEndpoints.getMyLikeProductList, getLikedProductsForUser_API);
router.get(userEndpoints.getTurtlePicks, getTurtlePicks_API);

router.post(userEndpoints.setProductLikeStatus, updateProductLike_API);

// Share
router.post(userEndpoints.saveShareProduct, saveProductShareActivity_API);

// Coin Related
router.get(userEndpoints.getUserCoins, getCoinsForUser_Api);
router.get(userEndpoints.getCoinActionList, getCoinActionListApi_UP);
router.post(userEndpoints.updateUserCoinActivityList, saveUserCoinActivity_API);

// Cart Related
router.get(userEndpoints.getCartItems, getUserCartItemApi_UP);
router.post(userEndpoints.updateCartItems, updateCartApi_UP);

// product-related
router.get(userEndpoints.getProducts, getProductsByPagination_API);
router.get(userEndpoints.getProductDetail, getProductDetailApi_UP);
router.get(userEndpoints.getPopularProducts, getPopularProductsApi_UP);
router.get(userEndpoints.getProductsByOwner, getProductsByOwnerApi_UP);
router.get(userEndpoints.getProductBySearchTerm, getProductsBySearchTermApi_UP);
router.get(userEndpoints.getForageItems, getForageItems_API);
router.get(userEndpoints.getRelatedProducts, getRelatedProducts_API);
// referral-code
router.get(userEndpoints.getReferralCode, getReferralCodeApi_UP);
router.post(userEndpoints.checkReferralCodeValidity, checkReferralCodeValidity_API);

// analytics
router.post(userEndpoints.updateUserAnalytics, updateUserAnalyticsListApi_UP);

// Notification
router.post(userEndpoints.saveNotificationToken, saveDeviceInfo_API);

// community
router.get(userEndpoints.getArticles, getArticles_API);
// payment
router.post(userEndpoints.makePayment, makePaymentApi_UP);
router.post(userEndpoints.makePaymentVersion2, makePaymentV2Api);
router.post(userEndpoints.saveOrder, saveOrderApi_UP);
router.post(userEndpoints.updateShippingAddress, updateShippingAddressApi_UP);
router.get(userEndpoints.getShippingAddress, getShippingAddressApi_UP);
router.get(userEndpoints.getOrderListForUser, getOrderListForUserApi);

// app-related
router.get(userEndpoints.getPopularTagsList, getCategoriesInPopularityOrder_API);
router.get(userEndpoints.getDataFilteredByTags, getDataForSpinTheWheelApi_UP);
router.get(userEndpoints.getMerchantList, getMerchantListApi_UP);

router.get(userEndpoints.getLatestSiteDeployment, getLatestSiteDeploymentInfo_API);
router.get(userEndpoints.getUserStatForPAWave2020, getUserStatForPAWave2020_API);

//kk Event
router.get(userEndpoints.getUserStatForKKEvent2021, getUserStatForKKEvent2021_API);

// Bartering
router.post(userEndpoints.barteringModifyProduct, barteringModifyProductApi);
router.get(userEndpoints.barteringDeleteProduct, barteringDeleteProductApi);
router.post(userEndpoints.barteringLikeProduct, barteringLikeProductApi);
router.get(userEndpoints.barteringGetAllProductsAddedByCurrentUser, barteringGetAllProductsApi);
router.get(userEndpoints.barteringGetRelevantProducts, barteringGetRelevantProductsApi);
router.get(userEndpoints.barteringGetMatches, barteringGetMatchesApi);
router.get(userEndpoints.barteringGetProductDetail, barteringGetProductDetailApi);
router.get(userEndpoints.barteringGetProductDetailWithRelevance, barteringGetProductDetailWithRelevanceApi);
router.post(userEndpoints.barteringChat, barteringPostMessageApi);
//#### ADMIN PORTAL
router.post(mpEndpoints.addNewUser, createNewMerchantApi_MP);
router.post(mpEndpoints.addProfilePicture, addProfilePictureApi_MP);
router.get(mpEndpoints.getMerchantProfile, getMerchantProfileApi_MP);
router.get(mpEndpoints.getUserList, getAllUsersApi_MP);
router.get(mpEndpoints.getOrders, getOrdersApi_MP);
router.post(mpEndpoints.addRemark, addRemarkApi_MP);
router.get(mpEndpoints.getProducts, getAllProductsApi_MP);
router.post(mpEndpoints.reorderProductImages, reorderProductImageApi_MP);
router.get(mpEndpoints.getMerchantList, getMerchantListApi_MP);
router.get(mpEndpoints.getMerchantList, getMerchantListApi_MP);
router.get(mpEndpoints.getDeviceList, getDeviceList_MP);
router.post(mpEndpoints.addNotificationLog, notificationLogDB_MP);
router.get(mpEndpoints.getRegistrationToken, getRegistrationToken_MP);
router.get(mpEndpoints.getAllRegistrationToken, getAllRegistrationToken_MP);

router.post(mpEndpoints.addLinkToDb, addArticleToDb_Api);
router.post(mpEndpoints.sendEmailToUser, massEmailUsersAPI_MP);
router.post(mpEndpoints.sendNotificationToAllUsers, sendNotificationToAllUsers_API);
// ######## Merchant SECTION ENDS########

router.post(generalEndpoints.makeCorsRequest, makeCORSRequest);

export default router;
