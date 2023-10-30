export const isProductionEnvironment = () => {
	return process.env.NODE_ENV === 'production';
};

export const isUATEnvironment = () => {
	return process.env.NODE_ENV === 'uat';
};

export const isRunningOnServer = () => {
	return process.env.RUNNING_ON_LOCAL !== 'true';
};
