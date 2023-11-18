import io from 'socket.io-client'
import EventEmitter from 'events';

export enum Status {
	online,
	offline
}
export interface ServerContainer {
	vmname: string;
	vmname_encoded: string;
	status: Status;
}
export enum Distro {
	debian="debian",
	archlinux="archlinux",
	"duckcloud/suspiral"="duckcloud/suspiral"
}
export class HTTPError extends Error {
	constructor(message: string, public statuscode: number) {
		super(message);
		this.name = "HTTPError";
	}
}
export class User {
	constructor(public token: string, public duckcloud: DuckCloud) {}
	async GetContainers(): Promise<Container[]> {
		const resp = await fetch(this.duckcloud.server + "/listContainer", {
			headers: { Cookie: `token=${this.token}` }
		});
		const containers: ServerContainer[] = await resp.json();
		const pcontainers: Container[] = [];

		for (const [_, container] of containers.entries()) {
			pcontainers.push(new Container(_, container.vmname, container.status, this.duckcloud))
		}
		
		return pcontainers;
	}
	Request(input: string, init?: RequestInit | undefined): Promise<Response> {
		if (!init) init = {};
		init.headers = { Cookie: `token=${this.token}` }
		return fetch(this.duckcloud.server+input, init);
	}
	/**
	 * Creates a container.
	 * @param name Name of the container
	 * @param network Network enabled
	 * @param pro Pro mode
	 * @param distro Distribution of linux to be installed on the container
	 * @returns HTTP Status Code
	 */
	async CreateContainer(name: string, network: boolean, pro: boolean, distro: Distro): Promise<number> {
		const body = new URLSearchParams();
		body.append('vm_name', name);
		body.append('shouldHaveNetworking', network.toString());
		body.append('shouldUse512mbRAM', pro.toString());
		body.append('distro', distro.toString())
		const resp = await this.Request('/newVM', {
			method: 'POST',
			body
		});
		return resp.status
	}
	/**
	 * Apply pro code, created within the `pro_coder` account
	 * @param code PRO code
	 * @returns HTTP Status Code
	 */
	ApplyForPro(code: string): Promise<number> {
		// Apply pro token
		const body = new URLSearchParams();
		body.append('code', code);
		return this.Request("/pro_apply", {
			method: 'POST',
			body,
			redirect: 'manual'
		}).then(resp => resp.status);
	}
	
}
export class TCPConnection extends EventEmitter {
	public socket: import("socket.io-client").Socket;
	public open: boolean = false;
	constructor(public container: Container, public rport: number) {
		super();
		this.socket = io(container.duckcloud.server, {
			transportOptions: {
				polling: {
					extraHeaders: {
						Cookie: `token=${container.duckcloud.User.token}`
					}
				}
			}
		});
		this.socket.on('connect', () => {
			this.socket.emit('tcp_vmselect', container.id, rport);
			this.open = true;
			this.emit('open');
		})
		this.socket.on('datad', data => {
			this.emit('data', data); // data is a buffer
		})
		this.socket.on('disconnect', () => {
			this.emit('close');
		})
	}
	write(data: Buffer) {
		this.socket.emit('datad', data);
	}
	close() {
		this.socket.disconnect();
	}
}
export class Shell extends EventEmitter {
	public socket: import("socket.io-client").Socket;
	constructor(public container: Container) {
		super();
		this.socket = io(container.duckcloud.server, {
			transportOptions: {
				polling: {
					extraHeaders: {
						Cookie: `token=${container.duckcloud.User.token}`
					}
				}
			}
		});
		this.socket.on('connect', () => {
			this.socket.emit('vmselect', this.container.id);
			this.emit('connect')
		})
		this.socket.on('datad', data => {
			this.emit('data', data);
		})
		this.socket.on('disconnect', data => {
			this.emit('disconnect');
		})
	}
	/**
	 * Sends the characters in {@link data} to the container's stdin.
	 * @param data The characters to send
	 */
	Send(data: string | number) {
		this.socket.emit('datad', data);
	}
	/**
	 * Resize the container's pty
	 * @param width Width of the pty
	 * @param height Height of the pty
	 */
	Resize(width: number, height: number) {
		this.emit('resize', width, height);
	}
	/**
	 * Disconnect from the shell.
	 */
	Disconnect() {
		this.socket.disconnect();
	}
}
export class Container {
	constructor(public id: number, public name: string, public status: Status, public duckcloud: DuckCloud) {}
	/**
	 * Toggle a Container's power.
	 * @returns Boolean indicating success when true
	 */
	TogglePower(): Promise<boolean> {
		return fetch(this.duckcloud.server+"/shutoff/"+this.id,
			{ headers: { Cookie: `token=${this.duckcloud.User.token}`}})
				.then(resp => resp.text())
				.then(data => {
					if (data.includes('Sorry, your VM failed to launch')) {
						// VeNT
						return false;
					}
					return true;
				})
	}
	/**
	 * Removes/Deletes the VM.
	 * @returns boolean indicating success
	 */
	Remove(): Promise<boolean> {
		return fetch(`${this.duckcloud.server}/burn/${this.id}`, {
			headers: { Cookie: `token=${this.duckcloud.User.token}` }
		}).then(resp => resp.status === 200);
	}
	/**
	 * Get this container's shell
	 * @returns Container's shell
	 */
	Shell(): Shell {
		return new Shell(this);
	}
}
export class DuckCloud {
	public User!: User;
	constructor(public server: string) {}
	/**
	 * Logs onto a user
	 * @param username DuckCloud ID of the user
	 * @param password Password of the User
	 * @returns {boolean} Indicating success when true
	 */
	async Login(username: string, password: string): Promise<boolean> {
		const creds = new URLSearchParams();
		creds.append('username', username);
		creds.append('password', password);
		const resp = await fetch(`${this.server}/login`, {
			method: 'POST',
			body: creds,
			redirect: 'manual'
		});
		const token = resp.headers.get('set-cookie')?.split(';')[0].split('=')[1];
		if (!token) return false;
		this.LoginWithToken(token);
		return true;
	}
	/**
	 * Login with a token
	 * @param token Token of the user
	 */
	LoginWithToken(token: string) {
		this.User = new User(token, this);
	}
	async GetTokenFromULDeviceID(deviceId: string): Promise<string> {
		const req = await fetch(`${this.server}/ul_link?deviceID=${deviceId}`, { redirect: 'manual' });
		const token = req.headers.get('set-cookie')?.split(';')[0].split('=')[1];
		if (req.headers.get('Location')?.startsWith("https://ultimatelogon.pcprojects.tk/blocked_user")) {
			throw new ULBlockedError('This user has been blocked from authenticating with UltimateLogon.');
		}
		if (!token) throw new NoTokenError('DuckCloud token is missing from Ultimatelogon login request');
		return token;
	}
}
export class NoTokenError extends Error {
	constructor(msg: string) {
		super(msg);
		this.name = "NoTokenError";
	}
}
export class ULBlockedError extends Error {
	constructor(msg: string) {
		super(msg);
		this.name = "ULBlockedError";
	}
}