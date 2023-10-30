import { getMerchantProfileDB_MP } from '.';
import { Database } from '../../database';
import { isUserAuthenticated, downloadImage } from '../../util';
import { Status, sendResponse } from '../../util/log-response.util';
import { Request, Response } from 'express';
import { AzureStorageFileUploader } from '../../util';
import { getLinkPreview } from 'link-preview-js';
export const addArticleToDb_Api = async (request: Request, response: Response) => {
	const fileUploader = new AzureStorageFileUploader();
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

	const merchant = await getMerchantProfileDB_MP({ uid: user && user.uid }).catch(async (error) => {
		console.error({ authorization: request.headers.authorization }, error);
		sendApiRes(405, 'authorization failed');
	});

	if (!(merchant && merchant.isAdmin)) {
		sendApiRes(405, 'authorization failed');
	}

	let { articles, publisherUID } = request.body;
	if (!(articles && publisherUID)) {
		sendApiRes(405, 'articles or publisherUID not found');
	}
	// filter unique article links
	articles = (articles as any[]).filter(
		(article, index, self) => self.findIndex((s) => s.link === article.link) === index
	);

	const linkRequestArray = [];

	for (let article of articles) {
		const { link, tags } = article;
		if (!(link && tags)) {
			console.error('Either tag or link is not present.');
			sendApiRes(500, 'Either tag or link is not present.');
			return;
		}
		linkRequestArray.push({
			link,
			promise: async (link: string) => {
				const articleExists = await Database.query
					.one(
						`
				SELECT 1 FROM v1.link WHERE website_url = '${link}'
				`
					)
					.catch((error) => {
						console.log('new article');
					});
				if (articleExists) {
					console.error('article exists', link);
					return;
				}

				const publisher = await Database.query.one(
					`SELECT details->'profile'->>'fullName' as full_name, details->'profile'->>'avatarUrl' as avatar_url
					FROM v1.merchant WHERE unique_id = '${publisherUID}'
					`
				);

				if (!!!publisher) {
					sendApiRes(405, 'Create publisher in merchant table first.');
					return;
				}

				const articleDetails = (await getLinkPreview(link)) as any;
				articleDetails.favicons = [publisher.avatar_url];
				articleDetails.siteName = publisher.full_name;
				const { siteName, url } = articleDetails;
				const articleImagesFolders = `user-portal/article-images/${siteName || 'general'}`;
				if (!(articleDetails && articleDetails.images && articleDetails.images.length > 0)) {
					console.error('SKIPPING: ', 'article does not have any images.', url);
					return;
				}
				let imageUrl = null;
				let downloadImageRes = null;
				for (let image of articleDetails.images) {
					imageUrl = image;
					downloadImageRes = await downloadImage(image).catch((error) => {
						console.error('Skipped: could not download image', link);
					});
					if (downloadImageRes) {
						break;
					}
				}

				if (!downloadImageRes) {
					return;
				}

				const { body } = downloadImageRes as any;

				let fileName = imageUrl.substring(imageUrl.lastIndexOf('/') + 1);
				const fullPath = `${articleImagesFolders}/${fileName}`;

				const azureImageUrl = await fileUploader
					.uploadReadableStreamToAzureStorage({ data: body, filePath: fullPath })
					.catch((error) => {
						console.error('upload to error failed: ', error, fullPath, imageUrl);
					});

				if (!azureImageUrl) {
					return;
				}

				articleDetails.images[0] = (azureImageUrl as string).replace(/%2F/g, '/');
				const sql = `
				INSERT INTO v1.link (
					verified,
					website_url,
					details,
					unique_id,
					owner
				) VALUES 
			(true,'${link}','${JSON.stringify({ ...articleDetails, tags: {} }).replace(
					/'/g,
					''
				)}', v1.id_generator(),'${publisherUID}')`;
				await Database.query.none(sql).catch((e) => {});

				console.log('LINK - inserted in db: ', link);
				return articleDetails;
			},
		});
	}

	const result = await Promise.all(
		linkRequestArray.map((linkRequest) => linkRequest.promise(linkRequest.link))
	);

	sendApiRes(200, '', result);
};
