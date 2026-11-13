// The repo has no @types/node, so the Node imports are untyped (as in the
// engine's tests). No ambient module declaration is added.
// @ts-expect-error TS2591: no type definitions for node:fs
import * as fs from "node:fs";
// @ts-expect-error TS2591: no type definitions for node:path
import * as path from "node:path";
import { type Host, HostError } from "./host";

declare const process: { cwd(): string };

/** The operating-system code and description of a failed call. */
function reasonOf(error: unknown): string {
	const e = error as { code?: unknown; message?: unknown } | null;
	const code = typeof e?.code === "string" ? e.code : "";
	const raw = typeof e?.message === "string" ? e.message : String(error);
	// Node messages look like "ENOENT: no such file or directory, open '/x'".
	const description = raw
		.replace(/^[A-Z0-9_]+:\s*/, "")
		.replace(/,\s*\w+\s+'.*$/s, "");
	if (code !== "" && description !== "") return `${code} (${description})`;
	return code !== "" ? code : description;
}

function wrap<T>(run: () => T): T {
	try {
		return run();
	} catch (error) {
		throw new HostError(reasonOf(error));
	}
}

/** The real file system, behind the typed Host interface. */
export function createNodeHost(): Host {
	return {
		readFile(file: string): Uint8Array {
			return wrap(() => new Uint8Array(fs.readFileSync(file)));
		},
		readDir(dir: string) {
			return wrap(() =>
				(fs.readdirSync(dir, { withFileTypes: true }) as unknown[]).map(
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
				),
			);
		},
		stat(file: string): "file" | "dir" | "none" {
			try {
				const s = fs.statSync(file);
				return s.isFile() ? "file" : s.isDirectory() ? "dir" : "none";
			} catch {
				return "none";
			}
		},
		writeFile(file: string, text: string): void {
			wrap(() => {
				fs.writeFileSync(path.resolve(file), text, "utf8");
			});
		},
		makeDir(dir: string): void {
			wrap(() => {
				fs.mkdirSync(path.resolve(dir), { recursive: true });
			});
		},
		cwd(): string {
			return process.cwd();
		},
	};
}
