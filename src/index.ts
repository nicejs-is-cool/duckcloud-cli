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

interface Container {
	vmname: string;
	vmname_encoded: string;
	status: 'online' | 'offline';
}

const __dirname = dirname(fileURLToPath(import.meta.url))

yargs(hideBin(process.argv))
	.scriptName('duckcl')
	.command('login <token>', 'Login with duckcloud', yargs => {
		return yargs.positional('token', {
			describe: 'Your token',
			type: 'string'
		})
	}, async argv => {
		//const config = JSON.parse(await fs.readFile(path.join(__dirname, "./config.json"), 'utf-8'));
		//config.token = argv.token;
		//await fs.writeFile(configf, JSON.stringify(config, null, 2));
		
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
		let lastPressedCtrlC = false
		socket.on('connect', () => {
			if (!argv.noClear) {
				socket.emit('datad', 'clear\n');
			}
			// resize lol
			socket.emit('resize', process.stdout.columns, process.stdout.rows);
			process.stdout.on('resize', () => {
				socket.emit('resize', process.stdout.columns, process.stdout.rows);
			})
			process.stdin.setRawMode(true);
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
				
				socket.emit('datad', d.toString('utf-8'))
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
			return fetch("https://duckcloud.pcprojects.tk/shutoff/"+cfw.config.selected, { headers: { Cookie: `token=${cfw.config.token}`}});
		}
		switch (argv.action) {
			case "shutdown": {
				spinnies.add('shutdown', { text: 'Shutdown' });
				await mkreq();
				spinnies.succeed('shutdown');
				break;
			}
			case "start": {
				spinnies.add('start', { text: 'Startup' });
				await mkreq();
				spinnies.succeed('start');
				break;
			}
			case "restart": {
				spinnies.add('shutdown', { text: 'Shutdown' });
				spinnies.add('restart', { text: 'Restart' });
				await mkreq();
				spinnies.succeed('shutdown')
				console.log('Restarting...')
				await mkreq();
				spinnies.succeed('restart')
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
			socket.emit('datad', `cat << ${cfw.config.script.eof} | bash
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
			rl.question('Are you sure you want to delete this container? (y/n) ', async answer => {
				if (!answer.startsWith('y')) return process.exit(0);
				//const config = await readConfig()
				await fetch(`https://duckcloud.pcprojects.tk/burn/${cfw.config.selected}`, {
					headers: { Cookie: `token=${cfw.config.token}` }
				});
				process.exit(0)
			})
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
				network: argv.network || jsonfile.network || false,
				pro: argv.pro || jsonfile.pro || false
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
			/*const resp = await fetch("https://duckcloud.pcprojects.tk", {
				headers: { Cookie: `token=${config.token}` }
			});
			const pagehtml = await resp.text();
			const containers = qparse(pagehtml);
			*/
			const resp = await fetch("https://duckcloud.pcprojects.tk/listContainer", {
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
			console.error('No data type specified');
		})
	.demandCommand()
	.parse()