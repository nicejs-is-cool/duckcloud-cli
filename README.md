# duckcloud-cli
DuckCloud command line interface
### Install
```sh
$ npm i --location-global duckcloud-cli
$ pnpm add -g duckcloud-cli # pnpm install
$ yarn add -g duckcloud-cli # yarn install
```
### Usage
```sh
$ duckcl --help
duckcl <command>

Commands:
  duckcl login [username]   Login with duckcloud
  duckcl container <id>     Select a container
  duckcl sh                 Open shell in selected container
  duckcl powerctl <action>  power control
  duckcl script <path>      Run script on selected container (*will run as if th
                            e user typed it, shebang is not necessary)
  duckcl rm                 Delete selected container (cannot be undone)
  duckcl create             Create a new container
  duckcl ls                 List all containers
  duckcl config [path]      Modify/view configuration

Options:
  --help     Show help                                                 [boolean]
  --version  Show version number                                       [boolean]

```
### Where is the config
At `~/.duckcl.json5`
### Ultimatelogon
Ultimatelogon login is in beta and doesn't work right now, please don't try using it.
### How do I update my configuration?
If you upgraded to a newer version of `duckcloud-cli` with new configuration entries,
you'll need to run `duckcl config --reset` to reset your configuration back to
the newer defaults.
### How do I exit ~~vim~~ the shell?
Press Ctrl+] and `.`
### API Wrapper Documentation
You can use the API wrapper like this:
```ts
import { DuckCloud, Distro } from "duckcloud-cli";

const duckc = new DuckCloud("https://duckcloud.pcprojects.tk");
console.log(await duckc.Login(process.argv[2], process.argv[3]));
const containers = await duckc.User.GetContainers();
const shell = containers[0].Shell();
shell.on('data', (data: string) => {
	process.stdout.write(data);
})
shell.on('disconnect', () => { console.log('disconnect'); process.exit(0) });
```
- `<DuckCloud>.Login(username: string, password: string): Promise<boolean>` Logs into a account
- `<DuckCloud>.User` User object
- `<User>.GetContainers(): Container[]` Get all containers from the user
- `<User>.CreateContainer(name: string, network: boolean, pro: boolean, distro: Distro): Promise<number>` Create a container on the user account
- `Distro.debian` Debian
- `Distro.archlinux` Arch Linux
- `Distro["duckcloud/suspiral"]` Suspiral (custom debian)
- `Status.online` Online status
- `Status.offline` Offline status
- `<Container>.id` Id of the container
- `<Container>.name` Name of the container
- `<Container>.status` Status of the container
- `<Container>.TogglePower()` Toggle the container's power
- `<Container>.Remove()` Remove the container from existence
- `<Container>.Shell()` Get the container's shell



