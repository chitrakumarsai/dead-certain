// Test-only. An in-memory Host that records what is read.
import { HostError } from "@dead-certain/kb-tools";
import type { Host } from "../workspace";

export interface MemoryHost extends Host {
	/** Every path passed to readFile, in order. */
	readonly reads: string[];
	/** Every path passed to readDir or stat, in order. */
	readonly listed: string[];
}

/**
 * `files` maps absolute POSIX paths to contents. Paths in `links` are
 * reported as symlinks ("other"). Directories are implied by the files.
 */
export function memoryHost(
	files: Readonly<Record<string, string | Uint8Array>>,
	options: { cwd?: string; links?: readonly string[] } = {},
): MemoryHost {
	const links = new Set(options.links ?? []);
	const reads: string[] = [];
	const listed: string[] = [];
	const paths = [...Object.keys(files), ...links];
	const isDir = (dir: string) =>
		paths.some((p) => p.startsWith(`${dir}/`) && !links.has(dir));
	return {
		reads,
		listed,
		readFile(path) {
			reads.push(path);
			const text = files[path];
			if (text === undefined || links.has(path)) {
				throw new HostError("ENOENT (no such file or directory)");
			}
			return typeof text === "string" ? new TextEncoder().encode(text) : text;
		},
		readDir(dir) {
			listed.push(dir);
			if (!isDir(dir)) throw new HostError("ENOENT (no such directory)");
			const seen = new Map<string, "file" | "dir" | "other">();
			for (const p of paths) {
				if (!p.startsWith(`${dir}/`)) continue;
				const rest = p.slice(dir.length + 1);
				const name = rest.split("/")[0] ?? "";
				if (rest.includes("/"))
					seen.set(name, links.has(`${dir}/${name}`) ? "other" : "dir");
				else seen.set(name, links.has(p) ? "other" : "file");
			}
			return [...seen].map(([name, kind]) => ({ name, kind }));
		},
		stat(path) {
			listed.push(path);
			if (links.has(path)) return "other";
			if (files[path] !== undefined) return "file";
			return isDir(path) ? "dir" : "none";
		},
		cwd() {
			return options.cwd ?? "/ws";
		},
	};
}
