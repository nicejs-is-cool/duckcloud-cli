declare namespace PCd {
	export namespace Ultimatelogon {
		export interface DeviceStartSession {
			code: string;
			token: string;
		}
		export interface DeviceDetails {
			code: string;
			user: {
				username: string;
				password: string;
				token: string;
				appdata: any;
			}
		}
	}
	export namespace DuckCloud {
		export type Distro = "debian" | "archlinux"
	}
}