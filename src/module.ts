export enum Status {
	online,
	offline
}
export interface ServerContainer {
	vmname: string;
	vmname_encoded: string;
	status: Status;
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
}
export class Container {
	constructor(public id: number, public name: string, public status: Status, public duckcloud: DuckCloud) {}
	
}
export class DuckCloud {
	public user!: User;
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
		this.user = new User(token, this);
		return true;
	}
}
