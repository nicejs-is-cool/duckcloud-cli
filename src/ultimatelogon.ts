export class DeviceAuth {
	constructor(public code: string, public token: string) {}
	async check() {
		const resp = await fetch('https://ultimatelogon.pcprojects.tk/deviceDetails?device=' + this.token);
		const json: PCd.Ultimatelogon.DeviceDetails = await resp.json();
		return json;
	}
	wait(): Promise<PCd.Ultimatelogon.DeviceDetails> {
		return new Promise((resolve, reject) => {
			setInterval(() => {
				this.check()
					.then(data => {
						if (data.user) return resolve(data);
					})
					.catch(err => reject(err));
			}, 5000)
		})
	}
}

export async function StartDeviceAuth() {
	const deviceSession: PCd.Ultimatelogon.DeviceStartSession =
		await (await fetch("https://ultimatelogon.pcprojects.tk/deviceStartSess")).json();
	return new DeviceAuth(deviceSession.code, deviceSession.token);
}