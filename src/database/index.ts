// import * as dbConfig from '../db-config.json';
import promise from 'bluebird';
import pgPromise, { IInitOptions, IMain } from 'pg-promise'; // pg-promise core library
import pg from 'pg-promise/typescript/pg-subset';
import { Diagnostics } from './diagnostics'; // optional diagnostics

export class Database {
	static db: pgPromise.IDatabase<{}, pg.IClient>;
	static init() {
		const initOptions: IInitOptions<any> = {
			// Using a custom promise library, instead of the default ES6 Promise:
			promiseLib: promise,
		};
		// Initializing the library:
		const pgp: IMain = pgPromise(initOptions);
		const dbConnectionDetails = {
			connectionString: process.env.GREENDAY_DB_CONNECTION_STRING,
			ssl: {
				rejectUnauthorized: false,
			},
		};
		Database.db = pgp(dbConnectionDetails);
		// pg-promise initialization options:

		// Initializing optional diagnostics:
		Diagnostics.init(initOptions);
		Database.query.any('set search_path to v1;');
		// Alternatively, you can get access to pgp via Database.query.$config.pgp
		// See: https://vitaly-t.github.io/pg-promise/Database.html#$config
	}
	static get query() {
		return Database.db;
	}
}
