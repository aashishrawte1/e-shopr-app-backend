import { Request, Response } from 'express';
import { Readable } from 'stream';
import { Database } from '../../../database';
import {
	AzureStorageFileUploader,
	isUserAuthenticated,
	parseAuthorizationHeader,
	replaceSingleTickWithDoubleTick,
	sendResponse,
	Status,
} from '../../../util';
import { getUserCountry } from '../user.controller';
interface IAddProductFormData {
	images: Array<string>;
	title: string;
	description: string;
	priceMin: number;
	priceMax: number;
	productId: string;
}
export const barteringModifyProductApi = async (request: Request, response: Response) => {
	const fileUploader = new AzureStorageFileUploader();
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

	if (hasError) {
		return;
	}
	const { uid } = user || {};
	const authorizationKeyValMap = parseAuthorizationHeader(request);
	const country = await getUserCountry({ authorizationKeyValMap });
	const { productData } = request.body as { productData: IAddProductFormData };

	const { description = '', images = [], title = '' } = productData;
	let { productId = null } = productData;
	let { priceMax = 0, priceMin = 0 } = productData;
	priceMin = +priceMin;
	priceMax = +priceMax;
	if (!(description.length >= 10 && images.length && title.length >= 1)) {
		sendApiRes(500, 'invalid request.');
		return;
	}

	const sortedImageList = images.filter((f) => !!f);

	if (!sortedImageList?.length) {
		sendApiRes(500, 'images uploaded has invalid format.');
		return;
	}

	try {
		priceMin = +priceMin;
		priceMax = +priceMax;
	} catch (error) {
		priceMax = 0;
		priceMin = 0;
	}

	if (priceMax < priceMin) {
		sendApiRes(500, 'price has issue', { priceMax, priceMin });
		return;
	}

	// images to upload
	const imagesToUpload = sortedImageList
		.map((img, index) => ({ img, index }))
		.filter((item) => item.img.includes('data:image/jpeg;base64,'));

	if (imagesToUpload?.length) {
		// upload images to azure.
		for (let [index, base64Image] of (Object.entries(imagesToUpload) as unknown) as Array<
			[number, { img: string; index: number }]
		>) {
			const base64Data = base64Image.img.split(',')[1] as string;
			const buffer = Buffer.from(base64Data, 'base64');
			const readable = new Readable();
			readable._read = () => {}; // _read is required but you can noop it
			readable.push(buffer);
			readable.push(null);
			const imagePth = 'user-portal/bartering/product-images';

			// If this is new product, then we simply create one but we must use the same to create new product
			if (!productId) {
				productId = (await Database.query.one(`SELECT v1.id_generator() as id`)).id;
			}
			try {
				const fullPath = `${imagePth}/__${uid}__${productId}__${index}__.png`;
				const azureImageUrl = await fileUploader.uploadReadableStreamToAzureStorage({
					data: readable,
					filePath: fullPath,
				});

				if (!azureImageUrl) {
					sortedImageList.splice(+base64Image.index, 1);
					continue;
				}

				sortedImageList[+base64Image.index] = (azureImageUrl as string).replace(/%2F/g, '/');
			} catch (error) {
				console.error(error, 'not uploading this image');
			}
		}
	}

	let sql: string;
	if (!productData.productId) {
		sql = `
	INSERT INTO 
	v1.bartering_product_list 
	(product_id, posted_by, title, description, price_min, price_max, tags,images,country) 
  VALUES('${productId}','${uid}','${replaceSingleTickWithDoubleTick(
			title
		)}','${replaceSingleTickWithDoubleTick(description)}',${priceMin},${priceMax},'${JSON.stringify([
			'bartering',
		])}','${JSON.stringify(sortedImageList)}','${country}')`;
	} else {
		sql = `
		UPDATE  
	v1.bartering_product_list SET 
	title='${replaceSingleTickWithDoubleTick(title)}', description='${replaceSingleTickWithDoubleTick(
			description
		)}', price_min=${priceMin}, price_max=${priceMax}
		`;
		if (sortedImageList.length) {
			sql += `, images='${JSON.stringify(sortedImageList)}' `;
		}
		sql += `
		WHERE 
		posted_by='${uid}' AND 
		product_id='${productId}' AND 
		country='${country}';`;
	}

	const dbRes = await Database.query.none(sql).catch((e) => {
		sendApiRes(500, 'sql failed...');
	});

	if (hasError) {
		return;
	}

	sendApiRes(200, '', dbRes);
};
