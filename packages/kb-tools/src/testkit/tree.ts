// Test-only. Never imported from non-test source, never exported from index.ts.
import fc from "fast-check";
import { type Host, HostError } from "../cli/host";
import { faultArb } from "./faults";
import { kbArb } from "./kb";
import { renderYaml } from "./render";

/** A repository tree: files and empty directories, with paths relative to `root`. */
export interface TreeSpec {
	/** Absolute POSIX path of the repository root. */
	readonly root: string;
	/** Relative path to file content. Text is stored as UTF-8. */
	readonly files: Readonly<Record<string, string | Uint8Array>>;
	/** Relative paths of directories that hold no file. */
	readonly dirs: readonly string[];
	/** The KB_Files a run with no path arguments must find: `apps/<app>/kb/*.yaml`, sorted. */
	readonly kbFiles: readonly string[];
}

const encoder = new TextEncoder();

const APP_NAMES = ["claim-check", "pre-flight", "demo", "x_app"] as const;
const STEMS = ["policy", "rules", "a", "b-2"] as const;

const validContentArb = kbArb.map(renderYaml);
const brokenContentArb = fc.oneof(
	fc.constantFrom("facts: [", "id: 1\n", "", "- a\n- b\n", "rules: 3\n"),
	kbArb.chain((kb) => faultArb(kb).map((f) => f.text)),
);

const appArb = (app: string) =>
	fc
		.tuple(
			fc.uniqueArray(fc.constantFrom(...STEMS), { maxLength: 3 }),
			fc.subarray(
				[
					"kb/notes.md",
					"kb/data.yml",
					"kb/sub/nested.yaml",
					"kb/dist/policy.json",
					"kb/dist/stale.json",
					"kb/dist/inner/x.yaml",
					"package.json",
					"rulebook/rules.yaml",
				],
				{},
			),
		)
		.chain(([stems, extras]) =>
			fc
				.tuple(
					...stems.map(() =>
						fc.oneof(
							{ weight: 3, arbitrary: validContentArb },
							{ weight: 1, arbitrary: brokenContentArb },
						),
					),
				)
				.map((contents) => {
					const files: Record<string, string> = {};
					stems.forEach((stem, i) => {
						files[`apps/${app}/kb/${stem}.yaml`] = contents[i] ?? "";
					});
					for (const extra of extras) {
						files[`apps/${app}/${extra}`] = extra.endsWith(".json")
							? "{}\n"
							: "id: other\n";
					}
					return files;
				}),
		);

/**
 * A directory tree: `apps/<app>/kb/*.yaml` files (valid, faulty or unparsable), other
 * files that must be ignored, `kb/dist/` contents, unrelated folders, and a root
 * `pnpm-workspace.yaml`.
 */
export const treeArb: fc.Arbitrary<TreeSpec> = fc
	.tuple(
		fc.uniqueArray(fc.constantFrom(...APP_NAMES), { maxLength: 3 }),
		fc.subarray(
			[
				"packages/other/kb/y.yaml",
				"docs/a.yaml",
				"apps/loose.yaml",
				"kb/top.yaml",
			],
			{},
		),
		fc.subarray(
			["apps/empty-app/kb", "apps/demo/kb/dir.yaml", "scratch/empty"],
			{},
		),
	)
	.chain(([apps, unrelated, dirs]) =>
		fc.tuple(...apps.map(appArb)).map((perApp) => {
			const files: Record<string, string> = {
				"pnpm-workspace.yaml": "packages:\n  - apps/*\n",
			};
			for (const part of perApp) Object.assign(files, part);
			for (const path of unrelated) files[path] = "id: other\n";
			const kbFiles = Object.keys(files)
				.filter((p) => /^apps\/[^/]+\/kb\/[^/]+\.yaml$/.test(p))
				.sort();
			return { root: "/repo", files, dirs, kbFiles } satisfies TreeSpec;
		}),
	);

export interface MemoryHostOptions {
	/** Return readDir entries in a seeded pseudo-random order instead of sorted order. */
	readonly shuffleSeed?: number;
	/**
	 * Paths (absolute, or relative to the root) on which readFile, readDir, writeFile and
	 * makeDir raise a HostError, mapped to the reason it carries.
	 */
	readonly failOn?: Readonly<Record<string, string>>;
	/** Working directory; the root by default. */
	readonly cwd?: string;
}

export interface MemoryHost extends Host {
	/** Every path passed to writeFile, in call order. */
	readonly writes: string[];
	/** Every path passed to makeDir, in call order. */
	readonly madeDirs: string[];
	/** Current content of every file, absolute path to bytes. */
	readonly files: Map<string, Uint8Array>;
	/** Current text of a file (absolute path), or undefined if it does not exist. */
	readText(path: string): string | undefined;
}

function normalise(path: string, cwd: string): string {
	const parts: string[] = [];
	const full = path.startsWith("/") ? path : `${cwd}/${path}`;
	for (const part of full.split("/")) {
		if (part === "" || part === ".") continue;
		if (part === "..") parts.pop();
		else parts.push(part);
	}
	return `/${parts.join("/")}`;
}

function parentOf(path: string): string {
	const i = path.lastIndexOf("/");
	return i <= 0 ? "/" : path.slice(0, i);
}

function addAncestors(dirs: Set<string>, path: string): void {
	let current = path;
	for (;;) {
		dirs.add(current);
		if (current === "/") return;
		current = parentOf(current);
	}
}

/** An in-memory Host over a tree. It records every write and can fail on chosen paths. */
export function memoryHost(
	tree: Pick<TreeSpec, "root" | "files" | "dirs">,
	options: MemoryHostOptions = {},
): MemoryHost {
	const root = normalise(tree.root, "/");
	const cwd = normalise(options.cwd ?? root, "/");
	const files = new Map<string, Uint8Array>();
	const dirs = new Set<string>();
	addAncestors(dirs, root);
	for (const [rel, content] of Object.entries(tree.files)) {
		const abs = normalise(rel, root);
		files.set(
			abs,
			typeof content === "string" ? encoder.encode(content) : content,
		);
		addAncestors(dirs, parentOf(abs));
	}
	for (const rel of tree.dirs) addAncestors(dirs, normalise(rel, root));

	const failing = new Map<string, string>();
	for (const [path, reason] of Object.entries(options.failOn ?? {})) {
		failing.set(normalise(path, root), reason);
	}
	const check = (abs: string): void => {
		const reason = failing.get(abs);
		if (reason !== undefined) throw new HostError(reason);
	};

	let seed = options.shuffleSeed;
	const shuffle = <T>(items: T[]): T[] => {
		if (seed === undefined) return items;
		for (let i = items.length - 1; i > 0; i--) {
			seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
			const j = seed % (i + 1);
			const a = items[i] as T;
			items[i] = items[j] as T;
			items[j] = a;
		}
		return items;
	};

	const writes: string[] = [];
	const madeDirs: string[] = [];
	return {
		writes,
		madeDirs,
		files,
		readText(path) {
			const bytes = files.get(normalise(path, cwd));
			return bytes === undefined ? undefined : new TextDecoder().decode(bytes);
		},
		readFile(path) {
			const abs = normalise(path, cwd);
			check(abs);
			if (dirs.has(abs))
				throw new HostError("EISDIR: illegal operation on a directory");
			const bytes = files.get(abs);
			if (bytes === undefined) {
				throw new HostError("ENOENT: no such file or directory");
			}
			return bytes;
		},
		readDir(path) {
			const abs = normalise(path, cwd);
			check(abs);
			if (files.has(abs)) throw new HostError("ENOTDIR: not a directory");
			if (!dirs.has(abs))
				throw new HostError("ENOENT: no such file or directory");
			const entries = new Map<string, "file" | "dir">();
			for (const f of files.keys()) {
				if (parentOf(f) === abs)
					entries.set(f.slice(abs === "/" ? 1 : abs.length + 1), "file");
			}
			for (const d of dirs) {
				if (d !== abs && parentOf(d) === abs) {
					entries.set(d.slice(abs === "/" ? 1 : abs.length + 1), "dir");
				}
			}
			const sorted = [...entries].sort(([x], [y]) =>
				x < y ? -1 : x > y ? 1 : 0,
			);
			return shuffle(sorted).map(([name, kind]) => ({ name, kind }));
		},
		stat(path) {
			const abs = normalise(path, cwd);
			return files.has(abs) ? "file" : dirs.has(abs) ? "dir" : "none";
		},
		writeFile(path, text) {
			const abs = normalise(path, cwd);
			check(abs);
			writes.push(abs);
			if (dirs.has(abs))
				throw new HostError("EISDIR: illegal operation on a directory");
			if (!dirs.has(parentOf(abs))) {
				throw new HostError("ENOENT: no such file or directory");
			}
			files.set(abs, encoder.encode(text));
		},
		makeDir(path) {
			const abs = normalise(path, cwd);
			check(abs);
			madeDirs.push(abs);
			if (files.has(abs)) throw new HostError("EEXIST: file already exists");
			addAncestors(dirs, abs);
		},
		cwd() {
			return cwd;
		},
	};
}
