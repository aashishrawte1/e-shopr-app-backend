import bodyParser from 'body-parser';
import compression from 'compression'; // compresses requests
import cors from 'cors';
import express from 'express';
import flash from 'express-flash';
import lusca from 'lusca';
import router from './app.routes';
// Controllers (route handlers)
import { corsOptions } from './util';

// Create Express server
const app = express();
// Express configuration
app.use(compression());
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ limit: '20mb', extended: true }));

app.use(flash());
app.use(lusca.xframe('SAMEORIGIN'));
app.use(lusca.xssProtection(true));
app.use((request, response, next) => {
	console.log('URL HIT: ', request.url);
	response.header('Access-Control-Allow-Origin', '*');
	response.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
	next();
});

app.use(cors(corsOptions));

app.use(router);
export default app;
