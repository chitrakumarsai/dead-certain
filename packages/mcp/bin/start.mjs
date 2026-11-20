#!/usr/bin/env node
// Launcher for the MCP server. Builds dist/server.mjs when it is missing or
// older than the source, then runs it. Standard output carries MCP messages
// only, so the build's output goes to standard error. This is the only file in
// the package that starts a child process.
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";

const root = new URL("../", import.meta.url);
const bundleUrl = new URL("dist/server.mjs", root);

/** Newest modification time under a path, ignoring test files. */
function newest(url) {
	const stat = statSync(url);
	if (!stat.isDirectory()) return stat.mtimeMs;
	let latest = 0;
	for (const entry of readdirSync(url, { withFileTypes: true })) {
		if (entry.name.endsWith(".test.ts")) continue;
		const child = new URL(entry.name + (entry.isDirectory() ? "/" : ""), url);
		latest = Math.max(latest, newest(child));
	}
	return latest;
}

function stale() {
	if (!existsSync(bundleUrl)) return true;
	const source = Math.max(
		newest(new URL("src/", root)),
		newest(new URL("package.json", root)),
	);
	return statSync(bundleUrl).mtimeMs < source;
}

if (stale()) {
	const vite = new URL("node_modules/vite/bin/vite.js", root);
	const build = spawnSync(
		process.execPath,
		[vite.pathname, "build", "--logLevel", "silent"],
		{ cwd: root.pathname, stdio: ["ignore", 2, 2] },
	);
	if (build.status !== 0) {
		process.exitCode = build.status ?? 1;
	}
}

if (process.exitCode === undefined) {
	await import(bundleUrl.href);
}
