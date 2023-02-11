#!/usr/bin/env node
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import { dirname } from 'path';
import { fileURLToPath } from 'url'
import fs from 'fs/promises';
import io from 'socket.io-client';
import Spinnies from 'spinnies';
import readline from 'readline';
import * as cfw from './config.js';
import * as ul from './ultimatelogon.js'

interface Container {
	vmname: string;
	vmname_encoded: string;
	status: 'online' | 'offline';
}

const __dirname = dirname(fileURLToPath(import.meta.url))

function fetchw(input: RequestInfo | URL, init?: RequestInit | undefined): Promise<Response> {
	if (typeof input === "string") return fetch(cfw.config.server+input, init);
	return fetch(input, init);
}

yargs(hideBin(process.argv))
	.scriptName('duckcl')
	.command('login [username]', 'Login with duckcloud', yargs => {
		return yargs.positional('username', {
			describe: 'Your username (not required if used with --ultimate-logon)',
			type: 'string'
		}).option('ultimate-logon', {
			alias: ['u'],
			describe: 'Use UltimateLogon as the authentication method',
			type: 'boolean'
		}).option('password', {
			alias: ['p'],
			describe: 'Specify password inline',
			type: 'string'
		})
	}, async argv => {
		//const config = JSON.parse(await fs.readFile(path.join(__dirname, "./config.json"), 'utf-8'));
		//config.token = argv.token;
		//await fs.writeFile(configf, JSON.stringify(config, null, 2));
		if (argv.ultimateLogon) {
			//const deviceSession: PCd.Ultimatelogon.DeviceStartSession = await (await fetch("https://ultimatelogon.pcprojects.tk/deviceStartSess")).json();
			const device = await ul.StartDeviceAuth();
			console.log('Please go on https://ultimatelogon.pcprojects.tk/deviceLogon and input %s', device.code);
			const spinnies = new Spinnies();
			spinnies.add('wait4auth', { text: 'Waiting for authentication'});
			const user = await device.wait();
			spinnies.succeed('wait4auth');
			console.log(user);
			return process.exit(0);
		}
		if (!argv.username) return console.error('Please specify a username')
		const creds = new URLSearchParams();
		creds.append('username', argv.username)
		if (argv.password) {
			creds.append('password', argv.password);
		} else {
			const rl = readline.createInterface(process.stdin, process.stdout);
			const aquestion: (q: string) => Promise<string> = (q: string) => new Promise(resolve => rl.question(q, resolve));
			creds.append('password', await aquestion("Password: "))
		}
		//console.log(creds.toString());
		console.log('Authenticating...')
		/*const resp = await fetch('https://duckcloud.pcprojects.tk/login', {
			method: 'POST',
			body: creds
		})
		console.log('Status code:', resp.status);
		const cookie = resp.headers.get('set-cookie')
		
		console.log(cookie);*/
		const resp = await fetch(`${cfw.config.server}/login`, {
			method: 'POST',
			body: creds,
			redirect: 'manual'
		});
		console.log('Status code:', resp.status, resp.statusText)
		console.log('(Should be 302)');
		const token = resp.headers.get('set-cookie')?.split(';')[0].split('=')[1];
		//console.log(token);
		if (!token) return console.error('Token missing');
		cfw.config.token = token;
		process.exit(0);
	})
	.command('container <id>', 'Select a container', yargs => {
		return yargs.positional('id', {
			describe: 'ID of the container',
			type: 'string'
		})
	}, async argv => {
		if (isNaN(parseInt(argv.id || 'l'))) throw new Error('No id supplied');
		//const config = JSON.parse(await fs.readFile(configf, 'utf-8'));
		cfw.config.selected = parseInt(argv.id || 'l');
		//await fs.writeFile(path.join(__dirname, "./config.json"), JSON.stringify(config, null, 2))
		console.log('selected container', argv.id)
		process.exit(0);
	})
	.command('sh', 'Open shell in selected container', yargs => 
		yargs.option('no-clear', {
			alias: ['n'],
			describe: 'Don\'t clear the terminal when opening sh',
			type: 'boolean'
		}),
	async argv => {
		//const config = JSON.parse(await fs.readFile(configf, "utf-8"))
		const socket = io(cfw.config.server, {
			transportOptions: {
				polling: {
					extraHeaders: {
						Cookie: `token=${cfw.config.token}`
					}
				}
			}
		});
		socket.on('datad', data => process.stdout.write(data));
		socket.emit('vmselect', cfw.config.selected)
		let lastPressedCtrlC = false
		socket.on('connect', () => {
			if (!argv.noClear && cfw.config.sh.clearTerminalOnConnection) {
				socket.emit('datad', 'clear\n');
			}
			// resize lol
			if (cfw.config.sh.resizeTerminalOnConnection)
				socket.emit('resize', process.stdout.columns, process.stdout.rows);
			if (cfw.config.sh.listenForTerminalResize)
				process.stdout.on('resize', () => {
					socket.emit('resize', process.stdout.columns, process.stdout.rows);
				});
			process.stdin.setRawMode(cfw.config.sh.stdinRawMode);
			process.stdin.on('data', d => {
				//console.log(d[0], lastPressedCtrlC)
				if (d[0] === 3) {
					if (lastPressedCtrlC) {
						socket.disconnect();
					} else {
						lastPressedCtrlC = true;
					}
				} else {
					if (lastPressedCtrlC) lastPressedCtrlC = false;
				}
				
				socket.emit('datad', d.toString(cfw.config.sh.datadEncoding))
			});
		})
		socket.on('disconnect', () => {
			console.log('Disconnected');
			process.exit(0);
		})
	})
	.command('powerctl <action>', 'power control', yargs => {
		return yargs.positional('action', {
			describe: 'shutdown, start or restart',
			type: 'string'
		})
	}, async argv => {
		const spinnies = new Spinnies();
		//const config = await readConfig();
		function mkreq() {
			return fetch(cfw.config.server+"/shutoff/"+cfw.config.selected, { headers: { Cookie: `token=${cfw.config.token}`}})
				.then(resp => resp.text())
				.then(data => {
					if (data.includes('Sorry, your VM failed to launch') && cfw.config.powerctl.experimental.failureDetection) {
						// VeNT
						throw 'VM failed to launch';
					}
				})
		}
		switch (argv.action) {
			case "shutdown": {
				spinnies.add('shutdown', { text: 'Shutdown' });
				try {
					await mkreq()
					spinnies.succeed('shutdown');
				} catch(err: any) {
					spinnies.fail('shutdown', { text: err.toString() });
				}
				break;
			}
			case "start": {
				spinnies.add('start', { text: 'Startup' });
				try {
					await mkreq();
					spinnies.succeed('start');
				} catch(err: any) {
					spinnies.fail('start', { text: err.toString() })
				}
				break;
			}
			case "restart": {
				spinnies.add('shutdown', { text: 'Shutdown' });
				spinnies.add('restart', { text: 'Restart' });
				try {
					await mkreq();
					spinnies.succeed('shutdown')
				} catch(err: any) { spinnies.fail('shutdown', { text: err.toString() })}
				//console.log('Restarting...')
				try {
					await mkreq();
					spinnies.succeed('restart')
				} catch(err: any) { spinnies.fail('restart', { text: err.toString() })}
				break;
			}
		}
		process.exit(0);
	})
	.command('script <path>', 'Run script on selected container (*will run as if the user typed it, shebang is not necessary)', yargs =>
		yargs.positional('path', {
			describe: 'Path of the script file',
			type: 'string'
		}), async argv => {
			//const config = await readConfig();
			if (!argv.path) {console.error('missing file path'); return};
			const file = await fs.readFile(argv.path, 'utf-8');
			console.log('duckcl: Press Q to quit.');
			const socket = io("https://duckcloud.pcprojects.tk", {
				transportOptions: {
					polling: {
						extraHeaders: {
							Cookie: `token=${cfw.config.token}`
						}
					}
				}
			});
			socket.on('datad', data => process.stdout.write(data));
			socket.emit('vmselect', cfw.config.selected)
			socket.emit('datad', `${cfw.config.script.cat} << ${cfw.config.script.eof} | ${cfw.config.script.shell}
${file}
${cfw.config.script.eof}\n`);
			process.stdin.setRawMode(true);
			process.stdin.on('data', data => {
				if (data[0] === "q".charCodeAt(0)) {
					socket.disconnect();
				}
			})
			socket.on('disconnect', () => {
				console.log('Disconnected');
				process.exit(0);
			})
		})
		.command('rm', 'Delete selected container (cannot be undone)', yargs =>
			yargs.option('yes', {
				alias: 'y',
				describe: 'Do not ask for confirmation',
				default: false,
				type: 'boolean'
			})
		, async argv => {
			const rl = readline.createInterface(process.stdin, process.stdout);
			//const config = await readConfig();
			function del() {
				return fetch(`${cfw.config.server}/burn/${cfw.config.selected}`, {
					headers: { Cookie: `token=${cfw.config.token}` }
				});
			}
			if (!argv.yes || cfw.config.rm.askForConfirmation) {
				return rl.question('Are you sure you want to delete this container? (y/n) ', async answer => {
					if (!answer.startsWith('y')) return process.exit(0);
					//const config = await readConfig()
					await del();
					process.exit(0)
				})
			}
			await del();
		})
		.command('create', 'Create a new container', yargs => {
			return yargs
				.option('from-file', {
					alias: ['f', 'file'],
					type: 'string',
					describe: 'Create a new container from a JSON file'
				})
				.option('name', {
					alias: ['n'],
					type: 'string',
					describe: 'Name of the container'
				})
				.option('network', {
					alias: ['e', 'ethernet', 'internet'],
					type: 'boolean',
					describe: 'Enable networking in the container'
				})
				.option('pro', {
					alias: ['p', 'boost'],
					type: 'boolean',
					describe: 'Pro mode/boost (container won\'t be created if you don\'t have a pro account)'
				})
				/*.option('script', {
					alias: ['s', 'run-script'],
					type: 'string',
					describe: 'Run script on VM after installation'
				} //later */
		}, async argv => {
			let jsonfile: any = argv.fromFile ? JSON.parse(await fs.readFile(argv.fromFile, "utf-8")) : {};
			//const config = await readConfig()
			const settings = {
				name: argv.name || jsonfile.name,
				network: argv.network || jsonfile.network || cfw.config.create.networkingEnabledByDefault || false,
				pro: argv.pro || jsonfile.pro || cfw.config.create.proEnabledByDefault || false
			}
			if (!settings.name) return console.error('Missing container name');
			const body = new URLSearchParams();
			body.append('vm_name', settings.name);
			body.append('shouldHaveNetworking', settings.network);
			body.append('shouldUse512mbRAM', settings.pro);
			await fetch('https://duckcloud.pcprojects.tk/newVM', {
				method: 'POST',
				headers: { Cookie: `token=${cfw.config.token}` },
				body
			});
			console.log(`container "${settings.name}" created`);
			process.exit(0);
		})
		.command('ls', 'List all containers', yargs => yargs, async argv => {
			//const config = await readConfig();
			console.log('name\t\tstatus\tid');
			if (cfw.config.ls.useLegacyQuickParse) {
				const qparse = (await import("./quickparse.js")).default;
				const resp = await fetch("https://duckcloud.pcprojects.tk", {
					headers: { Cookie: `token=${cfw.config.token}` }
				});
				const pagehtml = await resp.text();
				const containers = qparse(pagehtml);
				for (const container of containers) {
					console.log(`${container.name}\t${container.online ? 'online': 'offline'}\t${container.id}`);
				}
				return;
			}
			const resp = await fetch(cfw.config.server + "/listContainer", {
				headers: { Cookie: `token=${cfw.config.token}` }
			});
			const containers: Container[] = await resp.json();
			for (const [_, container] of containers.entries()) {
				console.log(`${container.vmname}\t${container.status}\t${_}`);
			}
		})
		.command('config [path]', 'Modify/view configuration', yargs =>
			yargs.positional('path', {
				describe: 'Object path',
				type: 'string'
			}).option('set', {
				alias: ['e'],
				describe: 'Set key at object path to the value specified (combine with data type option)',
			}).option('string', {
				describe: 'String datatype',
				type: 'string',
				alias: ['s']
			}).option('number', {
				describe: 'Number datatype',
				type: 'number',
				alias: ['n']
			}).option('boolean', {
				describe: 'Boolean datatype',
				type: 'number',
				alias: ['b', 'bool']
			}).option('reset', {
				describe: 'Reset your entire configuration to the defaults (useful if upgrading to new version with more config entries)',
				type: 'boolean',
				alias: ['r']
			}).option('object', {
				describe: 'Object datatype (data parsed as JSON5)',
				type: 'string',
				alias: ['o', 'obj']
			})
		, async argv => {
			if (argv.reset) {
				await cfw.reset();
				return console.log('Configuration restored to defaults (-r/--reset)');
			}
			if (!argv.path) {
				console.log(cfw.cfgp);
				return;
			}
			if (!argv.set) {
				console.log(cfw.get(argv.path));
				return;
			}
			if (argv.string) return cfw.set(argv.path, argv.string);
			if (argv.number) return cfw.set(argv.path, argv.number);
			if (argv.boolean) return cfw.set(argv.path, !!argv.boolean);
			if (argv.object) {
				const JSON5 = await import('json5');
				
				return cfw.set(argv.path, JSON5.default.parse(argv.object));
			}
			console.error('No data type specified');
		})
	.demandCommand()
	.parse()