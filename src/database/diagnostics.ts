import os = require('os');
import * as pgMonitor from 'pg-monitor';
import { IInitOptions } from 'pg-promise';
import { dbLogger, isProductionEnvironment } from '../util';

export class Diagnostics {
	// Monitor initialization function;
	static init<Ext = {}>(options: IInitOptions<Ext>) {
		const production = isProductionEnvironment();
		pgMonitor.setTheme('matrix');
		pgMonitor.setLog((msg, info) => {
			if (info.event === 'error') {
				let logText = os.EOL + msg; // line break + next error message;
				if (info.time) {
					logText = os.EOL + logText;
				}

				dbLogger.log('error', logText);
			}

			if (production) {
				// If it is not a DEV environment:
				info.display = false; // display nothing;
			}
		});

		if (!production) {
			// In a DEV environment, we attach to all supported events:
			pgMonitor.attach(options);
		} else {
			// In a PROD environment we should only attach to the type of events
			// that we intend to log. And we are only logging event 'error' here:
			pgMonitor.attach(options, ['error']);
		}
	}
}
