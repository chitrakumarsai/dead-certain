/** One read-only seam between the tools and the file system. */
export interface Host {
	/** Throws when the file cannot be read. */
	readFile(path: string): Uint8Array;
	/** Throws when the directory cannot be read. A symlink is reported as "other". */
	readDir(
		path: string,
	): readonly { name: string; kind: "file" | "dir" | "other" }[];
	/** Does not follow symlinks. */
	stat(path: string): "file" | "dir" | "other" | "none";
	cwd(): string;
}

export interface KbFile {
	/** `<app>/<stem>`, for example `claim-check/policy`. */
	readonly ref: string;
	/** Relative to the Workspace_Root, with forward slashes. */
	readonly path: string;
}

export interface Workspace {
	/** The nearest ancestor of the working directory that holds pnpm-workspace.yaml. */
	root(): string | undefined;
	/** `apps/<app>/kb/<stem>.yaml`, sorted by ref in code-unit order. Empty with no root. */
	listKbFiles(): KbFile[];
	/** Read a path from listKbFiles (relative to the root). Throws when unreadable. */
	read(path: string): Uint8Array;
}

const MARKER = "pnpm-workspace.yaml";

function separatorOf(path: string): string {
	return path.includes("\\") && !path.includes("/") ? "\\" : "/";
}

function join(dir: string, name: string): string {
	const sep = separatorOf(dir);
	return dir.endsWith(sep) ? `${dir}${name}` : `${dir}${sep}${name}`;
}

function parentOf(dir: string): string {
	const trimmed = dir.length > 1 ? dir.replace(/[\\/]+$/, "") : dir;
	const cut = Math.max(trimmed.lastIndexOf("/"), trimmed.lastIndexOf("\\"));
	if (cut < 0) return dir;
	if (cut === 0) return trimmed.slice(0, 1);
	// A Windows drive root such as "C:\".
	if (cut === 2 && trimmed[1] === ":") return trimmed.slice(0, 3);
	return trimmed.slice(0, cut);
}

function entries(host: Host, dir: string) {
	try {
		return host.readDir(dir);
	} catch {
		return [];
	}
}

export function makeWorkspace(host: Host): Workspace {
	const root = (): string | undefined => {
		let dir = host.cwd();
		for (;;) {
			if (host.stat(join(dir, MARKER)) === "file") return dir;
			const parent = parentOf(dir);
			if (parent === dir) return undefined;
			dir = parent;
		}
	};

	const listKbFiles = (): KbFile[] => {
		const base = root();
		if (base === undefined) return [];
		const found: KbFile[] = [];
		for (const app of entries(host, join(base, "apps"))) {
			if (app.kind !== "dir") continue;
			const kbDir = join(join(join(base, "apps"), app.name), "kb");
			for (const file of entries(host, kbDir)) {
				if (file.kind !== "file" || !file.name.endsWith(".yaml")) continue;
				const stem = file.name.slice(0, -".yaml".length);
				if (stem === "") continue;
				found.push({
					ref: `${app.name}/${stem}`,
					path: `apps/${app.name}/kb/${file.name}`,
				});
			}
		}
		return found.sort((a, b) => (a.ref < b.ref ? -1 : a.ref > b.ref ? 1 : 0));
	};

	const read = (path: string): Uint8Array => {
		const base = root();
		if (base === undefined) throw new Error("no workspace");
		return host.readFile(join(base, path.split("/").join(separatorOf(base))));
	};

	return { root, listKbFiles, read };
}
