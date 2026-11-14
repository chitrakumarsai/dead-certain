import { type Host, HostError } from "./host";

export type Discovery =
	| {
			readonly ok: true;
			/** Absolute POSIX path of the repository root. */
			readonly root: string;
			/** Root-relative POSIX paths of the KB_Files, deduplicated and sorted. */
			readonly files: readonly string[];
	  }
	| {
			readonly ok: false;
			readonly kind: "usage" | "io";
			readonly message: string;
	  };

const KB_FILE = /^apps\/[^/]+\/kb\/[^/]+\.yaml$/;

function compareUnits(a: string, b: string): number {
	if (a < b) return -1;
	if (a > b) return 1;
	return 0;
}

function trimSlashes(path: string): string {
	let end = path.length;
	while (end > 1 && path[end - 1] === "/") end--;
	return path.slice(0, end);
}

/** The nearest ancestor of `cwd` (inclusive) that holds `pnpm-workspace.yaml`. */
function findRoot(host: Host): string | undefined {
	let dir = trimSlashes(host.cwd());
	for (;;) {
		const marker =
			dir === "/" ? "/pnpm-workspace.yaml" : `${dir}/pnpm-workspace.yaml`;
		if (host.stat(marker) === "file") return dir;
		if (dir === "/" || dir === "") return undefined;
		const i = dir.lastIndexOf("/");
		dir = i <= 0 ? "/" : dir.slice(0, i);
	}
}

/** Root-relative segments of an argument, or undefined if it leaves the root or has `..`. */
function segmentsOf(root: string, arg: string): string[] | undefined {
	let rel = arg;
	if (arg.startsWith("/")) {
		const prefix = root === "/" ? "/" : `${root}/`;
		if (arg !== root && !arg.startsWith(prefix)) return undefined;
		rel = arg === root ? "" : arg.slice(prefix.length);
	}
	const parts: string[] = [];
	for (const part of rel.split("/")) {
		if (part === "" || part === ".") continue;
		if (part === "..") return undefined;
		parts.push(part);
	}
	return parts;
}

function ioMessage(path: string, error: unknown): string {
	const reason =
		error instanceof HostError
			? error.reason
			: error instanceof Error
				? error.message
				: String(error);
	return `${path}: error ${reason}`;
}

/** `apps/<app>/kb/*.yaml` of one app, as root-relative paths. Missing directories give none. */
export function kbFilesOfApp(root: string, app: string, host: Host): string[] {
	const kbDir = `${root}/apps/${app}/kb`;
	if (host.stat(kbDir) !== "dir") return [];
	return host
		.readDir(kbDir)
		.filter((e) => e.kind === "file" && e.name.endsWith(".yaml"))
		.map((e) => `apps/${app}/kb/${e.name}`);
}

function allApps(root: string, host: Host): string[] {
	const appsDir = `${root}/apps`;
	if (host.stat(appsDir) !== "dir") return [];
	return host
		.readDir(appsDir)
		.filter((e) => e.kind === "dir")
		.map((e) => e.name);
}

/** Find the KB_Files a run covers (Requirement 16, criteria 1, 2, 7, 14). */
export function discover(paths: readonly string[], host: Host): Discovery {
	const root = findRoot(host);
	if (root === undefined) {
		return {
			ok: false,
			kind: "usage",
			message:
				"dc: no repository root found (no pnpm-workspace.yaml in this or any parent directory).",
		};
	}
	const found = new Set<string>();
	try {
		if (paths.length === 0) {
			for (const app of allApps(root, host)) {
				for (const file of kbFilesOfApp(root, app, host)) found.add(file);
			}
		} else {
			for (const arg of paths) {
				const parts = segmentsOf(root, arg);
				const rel = parts?.join("/") ?? "";
				let matched: string[] = [];
				if (parts !== undefined) {
					if (parts.length === 2 && parts[0] === "apps") {
						matched = kbFilesOfApp(root, parts[1] as string, host);
					} else if (KB_FILE.test(rel)) {
						matched = [rel];
					}
				}
				if (matched.length === 0) {
					return {
						ok: false,
						kind: "usage",
						message: `dc: '${arg}' matches no knowledge-base file (expected apps/<app>/kb/<name>.yaml or apps/<app>).`,
					};
				}
				for (const file of matched) found.add(file);
			}
		}
	} catch (error) {
		return { ok: false, kind: "io", message: ioMessage(root, error) };
	}
	return { ok: true, root, files: [...found].sort(compareUnits) };
}

const GOLDEN_FILE = /^apps\/[^/]+\/golden\/[^/]+\.yaml$/;

export type GoldenDiscovery =
	| {
			readonly ok: true;
			/** Absolute POSIX path of the repository root. */
			readonly root: string;
			/** Root-relative POSIX paths of the Golden_Files, deduplicated and sorted. */
			readonly files: readonly string[];
			/**
			 * The apps for which the run holds every Golden_File: all apps when no
			 * path was given, otherwise the `apps/<app>` directories that were passed.
			 */
			readonly wholeApps: readonly string[];
	  }
	| {
			readonly ok: false;
			readonly kind: "usage" | "io";
			readonly message: string;
	  };

/** `apps/<app>/golden/*.yaml` of one app, as root-relative paths. Missing directories give none. */
export function goldenFilesOfApp(
	root: string,
	app: string,
	host: Host,
): string[] {
	const dir = `${root}/apps/${app}/golden`;
	if (host.stat(dir) !== "dir") return [];
	return host
		.readDir(dir)
		.filter((e) => e.kind === "file" && e.name.endsWith(".yaml"))
		.map((e) => `apps/${app}/golden/${e.name}`);
}

/** Find the Golden_Files a `dc golden` run covers (Requirements 1.1, 8.1, 8.2, 8.5). */
export function discoverGolden(
	paths: readonly string[],
	host: Host,
): GoldenDiscovery {
	const root = findRoot(host);
	if (root === undefined) {
		return {
			ok: false,
			kind: "usage",
			message:
				"dc: no repository root found (no pnpm-workspace.yaml in this or any parent directory).",
		};
	}
	const found = new Set<string>();
	const wholeApps = new Set<string>();
	try {
		if (paths.length === 0) {
			for (const app of allApps(root, host)) {
				wholeApps.add(app);
				for (const file of goldenFilesOfApp(root, app, host)) found.add(file);
			}
		} else {
			for (const arg of paths) {
				const parts = segmentsOf(root, arg);
				const rel = parts?.join("/") ?? "";
				let matched: string[] = [];
				if (parts !== undefined) {
					if (parts.length === 2 && parts[0] === "apps") {
						matched = goldenFilesOfApp(root, parts[1] as string, host);
						if (matched.length > 0) wholeApps.add(parts[1] as string);
					} else if (GOLDEN_FILE.test(rel)) {
						matched = host.stat(`${root}/${rel}`) === "file" ? [rel] : [];
					}
				}
				if (matched.length === 0) {
					return {
						ok: false,
						kind: "usage",
						message: `dc: '${arg}' matches no golden file (expected apps/<app>/golden/<name>.yaml or apps/<app>).`,
					};
				}
				for (const file of matched) found.add(file);
			}
		}
	} catch (error) {
		return { ok: false, kind: "io", message: ioMessage(root, error) };
	}
	return {
		ok: true,
		root,
		files: [...found].sort(compareUnits),
		wholeApps: [...wholeApps].sort(compareUnits),
	};
}
