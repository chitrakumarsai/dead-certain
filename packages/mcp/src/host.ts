// The only file in src/ besides main.ts that imports node:*. Read only.
// No @types/node in the repo: the imports are untyped and the few names used
// are declared here, as kb-tools does.
// @ts-expect-error TS2591: no type definitions for node:fs
import * as fs from "node:fs";
import { HostError } from "@dead-certain/kb-tools";
import type { Host } from "./workspace";

declare const process: { cwd(): string };

function reasonOf(error: unknown): string {
	const code = (error as { code?: unknown } | null)?.code;
	return typeof code === "string" ? code : "unreadable";
}

/** The real file system, read only. A symlink is reported as "other". */
export function createNodeHost(): Host {
	return {
		readFile(file: string): Uint8Array {
			try {
				return new Uint8Array(fs.readFileSync(file));
			} catch (error) {
				throw new HostError(reasonOf(error));
			}
		},
		readDir(dir: string) {
			try {
				return (fs.readdirSync(dir, { withFileTypes: true }) as unknown[]).map(
					(entry) => {
						const d = entry as {
							name: string;
							isFile(): boolean;
							isDirectory(): boolean;
						};
						const kind: "file" | "dir" | "other" = d.isFile()
							? "file"
							: d.isDirectory()
								? "dir"
								: "other";
						return { name: d.name, kind };
					},
				);
			} catch (error) {
				throw new HostError(reasonOf(error));
			}
		},
		stat(file: string): "file" | "dir" | "other" | "none" {
			try {
				const s = fs.lstatSync(file) as {
					isFile(): boolean;
					isDirectory(): boolean;
				};
				return s.isFile() ? "file" : s.isDirectory() ? "dir" : "other";
			} catch {
				return "none";
			}
		},
		cwd(): string {
			return process.cwd();
		},
	};
}
