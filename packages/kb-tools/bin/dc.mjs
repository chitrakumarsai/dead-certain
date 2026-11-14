#!/usr/bin/env node
import { existsSync } from "node:fs";

const bundle = new URL("../dist/dc.mjs", import.meta.url);

if (existsSync(bundle)) {
	await import(bundle.href);
} else {
	process.stderr.write(
		'dist/dc.mjs is missing: run "pnpm --filter @dead-certain/kb-tools build"\n',
	);
	process.exitCode = 2;
}
