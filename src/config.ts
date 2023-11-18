import fs from 'fs/promises';
import fss from 'fs';
import os from 'os';
import path from 'path';
import JSON5 from 'json5';

export interface Config {
    token: string;
    selected: number;
    create: {
        networkingEnabledByDefault: boolean,
        proEnabledByDefault: boolean,
        defaultDistro: PCd.DuckCloud.Distro
    },
    rm: {
        askForConfirmation: boolean
    },
    sh: {
        clearTerminalOnConnection: boolean,
        resizeTerminalOnConnection: boolean,
        listenForTerminalResize: boolean,
        datadEncoding: BufferEncoding,
        stdinRawMode: boolean,
        ctrlOpenBracketCommandMode: boolean,
        ctrlDToDisconnect: boolean
    },
    ls: {
        useLegacyQuickParse: boolean,
    },
    script: {
        eof: string,
        shell: string,
        cat: string
    }
    powerctl: {
        experimental: {
            failureDetection: boolean
        }
    },
    server: string
}
export const global_config_folder_path = path.join(os.homedir(), "./.config")
export const config_folder_path = path.join(global_config_folder_path, "./duckcl");
export const config_path = path.join(config_folder_path, "./config.json5");
export const old_config_path = path.join(os.homedir(), "./.duckcl.json5");

export const defaultConfig: Config = {
    token: "",
    selected: 0,
    create: {
        networkingEnabledByDefault: false,
        proEnabledByDefault: false,
        defaultDistro: "debian"
    },
    rm: {
        askForConfirmation: true
    },
    sh: {
        clearTerminalOnConnection: false,
        resizeTerminalOnConnection: true,
        listenForTerminalResize: true,
        datadEncoding: 'utf-8',
        stdinRawMode: true,
        ctrlOpenBracketCommandMode: true,
        ctrlDToDisconnect: false
    },
    ls: {
        useLegacyQuickParse: false,
    },
    script: {
        eof: "DUCKCLOUD_CLI_SCRIPT_EOF",
        shell: "bash",
        cat: "cat"
    },
    powerctl: {
        experimental: {
            failureDetection: false
        }
    },
    server: "https://duckcloud.pcprojects.tk"
}
async function fileExists(path: string) {
    try {
        await fs.access(path, fs.constants.R_OK | fs.constants.W_OK)
        return true;
    } catch(err) {
        return false;
    }
}
export async function createConfig() {
    if (!await fileExists(global_config_folder_path)) await fs.mkdir(global_config_folder_path); // must be windows no way a linux user wouldn't have this folder
    if (!await fileExists(config_folder_path)) await fs.mkdir(config_folder_path);
    await fs.writeFile(config_path, JSON5.stringify(defaultConfig, null, 2), "utf-8");
}
export function hasOldConfig() {
    return fileExists(old_config_path);
}
export async function migrateConfig() {
    // must be run AFTER createConfig();
    // also assumes the old config exists
    const conf = await fs.readFile(old_config_path, "utf-8")
    await fs.writeFile(config_path, conf, { encoding: 'utf-8' });
}

try {
    await fs.access(config_path, fs.constants.R_OK | fs.constants.W_OK);
} catch(err: any) {
    console.warn('duckcl.config: warn: unable to access config file (%s), creating new one in %s', err.toString(), config_path)
    //await fs.writeFile(config_path, JSON5.stringify(defaultConfig, null, 2), "utf-8");
    await createConfig();
    if (await hasOldConfig()) {
        console.info('duckcl.config: info: found old configuration file, attempting migration...')
        await migrateConfig();
        console.info('duckcl.config: info: removing old configuration')
        await fs.unlink(old_config_path).catch(err => {
            console.error('duckcl.config: error: failed to remove old configuration:', err);
        })
    }
    console.info('duckcl.config: info: migrated to new configuration structure');
	process.exit(0)
}


export let cfgp: Config = JSON5.parse(await fs.readFile(config_path, 'utf-8'));
function mkproxy(obj: any): Config {
    return new Proxy(obj, {
        get(target: any, property, receiver) {
            //console.log(target, property, receiver);
            //return 69;
            if (typeof target[property] !== "object") {
                return target[property];
            }
            return mkproxy(target[property]);
        },
        set(target: any, p: string, value: any, receiver: any) {
            target[p] = value;
            //console.log(p, value);
            fss.writeFileSync(config_path, JSON5.stringify(cfgp, null, 2));
            return true;
        }
    })
}
export const config = mkproxy(cfgp);
export function get<T>(fpath: string): T {
    if (!fpath.includes('.')) {
        //@ts-ignore
        let a: any = cfgp[fpath];
        return a as T;
    }
    let lescrungo: any = cfgp;
    for (const part of fpath.split('.')) {
        if (!lescrungo[part]) throw new Error('object path does not exist');
        lescrungo = lescrungo[part];
    }
    return lescrungo;
}
export async function set(fpath: string, value: any) {
    if (!fpath.includes('.')) {
        (cfgp as any)[fpath] = value;
        await fs.writeFile(config_path, JSON5.stringify(cfgp, null, 2))
        return;
    }
    let lescrungo: any = cfgp;
    const split = fpath.split('.')
    for (const part of split.slice(0, -1)) {
        if (!lescrungo[part]) throw new Error('object path does not exist');
        lescrungo = lescrungo[part];
    }
    
    lescrungo[split[split.length - 1]] = value;
    await fs.writeFile(config_path, JSON5.stringify(cfgp, null, 2))
}

export function reset() {
    for (let key in cfgp) {
        delete (cfgp as any)[key];
    }
    for (let key in defaultConfig) {
        if (typeof (cfgp as any)[key] === "object") {
            (cfgp as any)[key] = structuredClone((defaultConfig as any)[key]);
            break;
        }
        (cfgp as any)[key] = (defaultConfig as any)[key];
    }
    return fs.writeFile(config_path, JSON5.stringify(defaultConfig, null, 2));
}