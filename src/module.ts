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
		const resp = await fetch(this.duckcloud.server+'/newVM', {
			method: 'POST',
			headers: { Cookie: `token=${this.token}` },
			body
		});
		return resp.status
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
		this.User = new User(token, this);
		return true;
	}
}
