export const getAlphaNumericFromString = (str: string) => {
	return str.replace(/[^a-zA-Z0-9_]/g, '');
};

export const replaceSingleTickWithDoubleTick = (str: string) => {
	return str.replace(/'/g, "''");
};

export const replaceSpaces = (str: string) => {
	return str.replace(/ /, '');
};

export const getNumberFromString = (str: string) => {
	return +(
		str
			.match(/[0-9]*[.]?[0-9]*/gim)
			.filter((f) => !!f)
			.map((m) => m.trim())
			.join('') || 0
	);
};
