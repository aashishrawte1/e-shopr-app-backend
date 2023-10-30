export const corsOptions = {
	origin: (origin, callback) => {
		callback(null, true);
	}
};
