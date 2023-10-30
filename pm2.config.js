module.exports = {
	apps: [
		{
			name: 'uat_server',
			script: 'dist/server.js',
			instances: 'max',
			autorestart: true,
			watch: false,
			exec_mode: 'cluster',
			env_uat: {
				NODE_ENV: 'local',
			},
			env_local: {
				NODE_ENV: 'local',
			},
		},
		{
			name: 'production_server',
			script: 'dist/server.js',
			instances: 'max',
			autorestart: true,
			watch: false,
			exec_mode: 'cluster',
			env_production: {
				NODE_ENV: 'production',
			},
		},
	],
	deploy: {
		uat: {
			user: 'greenday',
			ssh_options: 'StrictHostKeyChecking=no',
			host: ['40.65.136.150'],
			key: '~/.ssh/userportal-uat-backend-server_key.pem',
			ref: 'origin/main',
			repo: 'git@github.com:greenday-code/greenday-app-backend.git',
			path: '/home/greenday/mobile-app-prod/',
			'post-deploy': 'npm install --force && npm run start-production-server',
		},
		// pm2 creates a source directory and clones under that folder
		production: {
			user: 'greenday',
			ssh_options: 'StrictHostKeyChecking=no',
			host: ['52.139.218.238'],
			key: '~/.ssh/userportal-prod-backend-server_key.pem',
			ref: 'origin/main',
			repo: 'git@github.com:greenday-code/greenday-app-backend.git',
			path: '/home/greenday/mobile-app-prod/',
			'post-deploy': 'npm install --force && npm run start-production-server',
		},
	},
};
