export interface Container {
    name: string;
    online: boolean;
    id: number;
}
export const regex = /<div class="object" style="position: relative; top: 0px;"><b>(?<name>.+) <\/b><div class="(?<status>online|offline)-icon">dk<\/div><a href="\/settings\/(?<id>\d+)" class="arrow manage-vm">.<\/a><\/div>/;
/**
 * Parses html and returns a list of containers
 * @param html HTML string
 * @returns {Container[]} Container[]
 * @deprecated Use /listContainers endpoint instead
 */
export default function qparse(html: string): Container[] {
    let lines = html.split('\n').slice(13, -3);
    let results: Container[] = [];
    for (const line of lines) {
        const match = line.match(regex);
        if (!match) continue;
        if (!match.groups) continue;
        results.push({
            name: match.groups.name,
            online: match.groups.status === "online",
            id: parseInt(match.groups.id)
        });
    }
    return results;

}