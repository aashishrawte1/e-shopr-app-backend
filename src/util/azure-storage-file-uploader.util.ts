import {
	Aborter,
	BlockBlobURL,
	ContainerURL,
	ServiceURL,
	SharedKeyCredential,
	StorageURL,
	uploadFileToBlockBlob,
	uploadStreamToBlockBlob,
} from '@azure/storage-blob';
import Bluebird from 'bluebird';
import nodeFetch from 'node-fetch';

nodeFetch['Promise'] = Bluebird;

export class AzureStorageFileUploader {
	blobList: any[];
	rootCDNPath: string;
	ONE_MEGABYTE = 1024 * 1024;
	FOUR_MEGABYTES = 4 * this.ONE_MEGABYTE;
	ONE_MINUTE = 60 * 1000;

	containerName = 'cdn';
	credentials = new SharedKeyCredential(
		process.env.AZURE_STORAGE_ACCOUNT_NAME,
		process.env.AZURE_STORAGE_ACCOUNT_ACCESS_KEY
	);
	pipeline = StorageURL.newPipeline(this.credentials);

	serviceURL = new ServiceURL(
		`https://${process.env.AZURE_STORAGE_ACCOUNT_NAME}.blob.core.windows.net`,
		this.pipeline
	);

	containerUrl = ContainerURL.fromServiceURL(this.serviceURL, this.containerName);
	aborter = Aborter.timeout(30 * this.ONE_MINUTE);
	async uploadLocalFile({ localFilePath, cdnFilePath }: { localFilePath: string; cdnFilePath: string }) {
		const blockBlobURL = BlockBlobURL.fromContainerURL(this.containerUrl, cdnFilePath);
		await uploadFileToBlockBlob(this.aborter, localFilePath, blockBlobURL);
		return blockBlobURL.url;
	}

	async uploadReadableStreamToAzureStorage({ data, filePath }: { data: any; filePath: string }) {
		const uploadOptions = {
			bufferSize: this.FOUR_MEGABYTES,
			maxBuffers: 5,
		};
		const blockBlobURL = BlockBlobURL.fromContainerURL(this.containerUrl, filePath);
		await uploadStreamToBlockBlob(
			this.aborter,
			data,
			blockBlobURL,
			uploadOptions.bufferSize,
			uploadOptions.maxBuffers
		);

		console.log(`Local file "${filePath}" is uploaded as a stream`);
		console.log(`Container: "${this.containerName}" is created`);
		return blockBlobURL.url;
	}

	// eg. user-portal/product-images/82382989203902390239023
	async checkIfFileExistInAzureStorage({ filePathLike }: { filePathLike: string }) {
		const containerPath = filePathLike.substring(0, filePathLike.lastIndexOf('/'));
		const fileName = (await this.getBlobNames({ pathFromCDN: containerPath })).find((bl) =>
			bl.includes(filePathLike)
		);
		if (!fileName) {
			return;
		}

		return filePathLike + fileName.split(filePathLike)[1];
	}

	// eg. user-portal/product-images or user-portal/backend-assets
	async getBlobNames({ pathFromCDN }: { pathFromCDN: string }) {
		if (this.blobList?.length) {
			return this.blobList;
		}
		let marker = undefined;
		const list = [];
		console.log({ pathFromCDN });
		do {
			const listBlobsResponse = await this.containerUrl.listBlobFlatSegment(Aborter.none, marker, {
				prefix: pathFromCDN,
			});
			marker = listBlobsResponse.nextMarker;
			for (const blob of listBlobsResponse.segment.blobItems) {
				list.push(blob.name);
			}
		} while (marker);

		this.blobList = list;
		return list;
	}
}
