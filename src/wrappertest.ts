import { DuckCloud, Distro } from "./module.js";

const duckc = new DuckCloud("https://duckcloud.pcprojects.tk");
console.log(await duckc.Login(process.argv[2], process.argv[3]));
const containers = await duckc.User.GetContainers();
const shell = containers[0].Shell();
shell.on('data', (data: string) => {
	process.stdout.write(data);
})
shell.on('disconnect', () => { console.log('disconnect'); process.exit(0) });