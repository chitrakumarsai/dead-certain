// No @types/node in the repo: the Node imports are untyped, as in kb-tools.
// @ts-expect-error TS2591: no type definitions for node:child_process
import * as cp from "node:child_process";
// @ts-expect-error TS2591: no type definitions for node:fs
import * as fs from "node:fs";
// @ts-expect-error TS2591: no type definitions for node:os
import * as os from "node:os";
// @ts-expect-error TS2591: no type definitions for node:path
import * as path from "node:path";
// @ts-expect-error TS2591: no type definitions for node:url
import * as url from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

declare const process: { execPath: string };

const pkgRoot: string = path.resolve(
	path.dirname(url.fileURLToPath(import.meta.url)),
	"..",
);

let dir = "";

/** A copy of the package in a temporary directory, sharing node_modules. */
function makeCopy(): string {
	const d: string = fs.mkdtempSync(path.join(os.tmpdir(), "dc-mcp-start-"));
	for (const name of ["package.json", "vite.config.ts", "src", "bin"]) {
		fs.cpSync(path.join(pkgRoot, name), path.join(d, name), {
			recursive: true,
		});
	}
	fs.symlinkSync(
		path.join(pkgRoot, "node_modules"),
		path.join(d, "node_modules"),
	);
	return d;
}

function run(cwd: string): {
	status: number | null;
	stdout: string;
	stderr: string;
} {
	const r = cp.spawnSync(process.execPath, ["bin/start.mjs"], {
		cwd,
		input: "",
		encoding: "utf8",
		timeout: 25_000,
	});
	return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}

const bundle = () => path.join(dir, "dist", "server.mjs");
const mtime = (file: string): number => fs.statSync(file).mtimeMs;

describe("bin/start.mjs", () => {
	beforeAll(() => {
		dir = makeCopy();
	});
	afterAll(() => {
		fs.rmSync(dir, { recursive: true, force: true });
	});

	it("builds a missing bundle, writes nothing to stdout and exits 0", () => {
		fs.rmSync(path.join(dir, "dist"), { recursive: true, force: true });
		const r = run(dir);
		expect(r.status).toBe(0);
		expect(r.stdout).toBe("");
		expect(fs.existsSync(bundle())).toBe(true);
	});

	it("does not rebuild when the sources are older than the bundle", () => {
		const before = mtime(bundle());
		const r = run(dir);
		expect(r.status).toBe(0);
		expect(r.stdout).toBe("");
		expect(mtime(bundle())).toBe(before);
	});

	it("rebuilds when a source file is newer than the bundle", () => {
		const before = mtime(bundle());
		const future = new Date(Date.now() + 10_000);
		fs.utimesSync(path.join(dir, "src", "main.ts"), future, future);
		const r = run(dir);
		expect(r.status).toBe(0);
		expect(r.stdout).toBe("");
		expect(mtime(bundle())).toBeGreaterThan(before);
	});
});
