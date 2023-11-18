// user-made DuckCloud templates

// updated_debian.dct POC code:
// FLAG ENABLE_NET # default is false for all boolean flags but this implies true
// FLAG MEMORY 256
// FROM debian:12 # (error out if that's not an option)
// RUN apt-get update -y
// RUN apt-get upgrade -y

export class VMFlags {
	public enable_net: boolean = false;
	public memory: number = 128;
	public pro: boolean = false;
	public name: string = "";
	
	set(flag: 'ENABLE_NET', value: boolean): void;
	set(flag: 'MEMORY', value: number): void;
	set(flag: 'PRO', value: boolean): void;
	set(flag: 'NAME', value: string): void;
	set(flag: string, value: number | boolean | string): void {
		switch (flag) {
			case "ENABLE_NET": {
				this.enable_net = value as boolean;
				break;
			}
			case "MEMORY": {
				this.memory = value as number;
				break;
			}
			case "PRO": {
				this.pro = value as boolean;
				break;
			}
			case "NAME": {
				this.name = value as string;
				break;
			}
		}
	}
}

export class Template {
	public flags: VMFlags = new VMFlags();
	public runcmd: string[] = [];
	public base: string = "debian:12";

}

export function parse(file: string) {}