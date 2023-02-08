import fs from 'fs/promises';
import fss from 'fs';
import os from 'os';
import path from 'path';
import JSON5 from 'json5';

export interface Config {
    token: string;
    selected: number;
}

export const config_path = path.join(os.homedir(), "./.duckcl.json5");

export const defaultConfig = {
    token: "",
    selected: 0,
    create: {
        networkingEnabledByDefault: false,

    }
}

try {
    await fs.access(config_path, fs.constants.R_OK | fs.constants.W_OK);
} catch(err: any) {
    console.warn('duckcl-config: fatal: unable to access config file (%s), creating new one in %s', err.toString(), config_path)
    await fs.writeFile(config_path, JSON5.stringify(defaultConfig, null, 2), "utf-8");
	process.exit(0)
}


export const cfgp: Config = JSON5.parse(await fs.readFile(config_path, 'utf-8'));
function mkproxy(lastobj: string = ""): Config {
    return new Proxy(cfgp, {
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
            console.log(p, value);
            fss.writeFileSync(config_path, JSON5.stringify(cfgp, null, 2));
            return true;
        }
    })
}
export const config = mkproxy();
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
export function set(fpath: string, value: any): void {
    if (!fpath.includes('.')) {
        //@ts-ignore
        cfgp[fpath] = value;
    }
    let lescrungo: any = cfgp;
    const split = fpath.split('.')
    for (const part of split.slice(0, -1)) {
        if (!lescrungo[part]) throw new Error('object path does not exist');
        lescrungo = lescrungo[part];
    }
    lescrungo[split[split.length - 1]] = value;
}

export function reset() {
    return fs.writeFile(config_path, JSON5.stringify(defaultConfig, null, 2));
}