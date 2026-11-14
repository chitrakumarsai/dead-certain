/** Error a Host raises when it cannot do what was asked. `reason` is the operating-system reason. */
export class HostError extends Error {
	readonly reason: string;

	constructor(reason: string) {
		super(reason);
		this.name = "HostError";
		this.reason = reason;
	}
}

/** The single seam between the library and the file system. */
export interface Host {
	/** Throws HostError { reason } when the file cannot be read. */
	readFile(path: string): Uint8Array;
	readDir(
		path: string,
	): readonly { name: string; kind: "file" | "dir" | "other" }[];
	stat(path: string): "file" | "dir" | "none";
	writeFile(path: string, text: string): void;
	/** Recursive. */
	makeDir(path: string): void;
	cwd(): string;
}
