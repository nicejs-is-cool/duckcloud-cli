// Plugin Read-only File System

/*
struct folder_t {
	unsigned int file_count;
	char name[64];
}
struct file_t {
	uint64_t offset; // offset from the start of the image
	uint64_t file_size;
	char name[64];
}
*/
interface folder_t {
	file_count: number;
	name: string;
}
interface file_t {
	offset: bigint;
	file_size: bigint;
	name: string;
}

function parseFolder() {
	

}
// read class
export default class PROFS {
	constructor(private buffer: Buffer) {}
	public readVersion() {
		return this.buffer.readInt32LE(6);
	}
	private getMagicBytes() {
		return this.buffer.subarray(0, 5).toString('utf-8');
	}
	checkMagicBytes() {
		return this.getMagicBytes() === "PROFS";
	}
	// file descriptor table
	private readFDTSize(): bigint {
		return this.buffer.readBigInt64LE(6+8+5); // yeah its literally the first bytes
	}
	private splitPath(path: string) {
		return path.split('/');
	}
	public readdir(path: string) {
		const paths = this.splitPath(path);
		
	}
}

// creating a PROFS image will be added later