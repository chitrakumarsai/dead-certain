import { createNodeHost } from "./host-node";
import { runCli } from "./run";

// No @types/node in the repo: declare only what this entry uses.
declare const process: {
	argv: string[];
	exitCode?: number;
	stdout: { write(text: string): unknown };
	stderr: { write(text: string): unknown };
};

// Runs when imported, so `node dist/dc.mjs` works directly. Never calls
// process.exit, so buffered output is flushed.
const result = runCli(process.argv.slice(2), createNodeHost());
if (result.stdout !== "") process.stdout.write(result.stdout);
if (result.stderr !== "") process.stderr.write(result.stderr);
process.exitCode = result.exitCode;
