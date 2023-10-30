import { writeFileSync } from 'fs';
import csv from 'csvtojson';
export const parseCSVToJSONFromFile = async ({ fileLocation }: { fileLocation: string }) => {
	const data = await csv({
		trim: true,
		output: 'json',
		ignoreEmpty: false,
		flatKeys: true,
		nullObject: true,
	}).fromFile(fileLocation);
	return data;
};

export const parseCSVToJSONFromText = async ({ str }: { str: string }) => {
	const data = await csv({
		trim: true,
		output: 'json',
		ignoreEmpty: false,
		flatKeys: true,
		nullObject: true,
	}).fromString(str);
	return data;
};
