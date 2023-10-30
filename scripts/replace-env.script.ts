import { resolve } from 'path';
import * as shell from 'shelljs';
const args = process.argv.slice(2);

if (args.length < 1) {
	throw Error('Missing arguments.');
}

const possibleArgs = {
	'--running-on-local=': '--running-on-local=',
	'--env=': '--env=',
};

const getArg = (argToFind: string) => {
	return ((args.find((a) => a.includes(argToFind)) || '').split(argToFind) || [])[1];
};

const env = getArg(possibleArgs['--env=']);
console.log({ [`${possibleArgs['--env=']}`]: env });

const production = env === 'production';

const fileReplacements = {
	uat: [
		{
			source: 'env/.env.uat',
			target: 'env/.env',
		},
		{
			source: 'env/firebase-admin.uat.json',
			target: 'env/firebase-admin.json',
		},
	],
	prod: [
		{
			source: 'env/.env.prod',
			target: 'env/.env',
		},
		{
			source: 'env/firebase-admin.prod.json',
			target: 'env/firebase-admin.json',
		},
	],
};

for (const replacement of fileReplacements[production ? 'prod' : 'uat']) {
	shell.cp('-R', replacement.source, replacement.target);
}

const runningOnLocal = getArg(possibleArgs['--running-on-local=']) === 'true';
console.log({ [`${possibleArgs['--running-on-local=']}`]: runningOnLocal });
if (runningOnLocal) {
	console.log(`${resolve(__dirname, '../env/.env')}`);
	shell.exec(`echo \nRUNNING_ON_LOCAL=true >> env/.env`);
}
