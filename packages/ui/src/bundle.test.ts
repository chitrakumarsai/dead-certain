// @ts-expect-error TS2591: no type definitions for node:url
import { fileURLToPath } from "node:url";
// @ts-expect-error TS2591: no type definitions for node:zlib
import { gzipSync } from "node:zlib";
import { build, type Rolldown } from "vite";
import { beforeAll, expect, test } from "vitest";

/**
 * The kit's size budget (task 9.6): the library build of packages/ui, with
 * React and React DOM left out, gzips to 50 kB or less. The X-ray develop, the
 * kit's only use of Motion, loads on demand in its own chunk and is reported
 * beside the budget, not inside it.
 */
const BUDGET = 50 * 1024;

let chunks: Rolldown.OutputChunk[] = [];

beforeAll(async () => {
	const output = await build({
		configFile: false,
		logLevel: "silent",
		build: {
			write: false,
			minify: true,
			lib: {
				entry: fileURLToPath(new URL("./index.ts", import.meta.url)),
				formats: ["es"],
			},
			rolldownOptions: { external: [/^react($|\/)/, /^react-dom($|\/)/] },
		},
	});
	const bundles = Array.isArray(output) ? output : [output];
	chunks = bundles
		.flatMap((bundle) => ("output" in bundle ? bundle.output : []))
		.filter((file): file is Rolldown.OutputChunk => file.type === "chunk");
}, 60_000);

const kb = (bytes: number) => `${(bytes / 1024).toFixed(1)} kB`;
const gzipped = (list: Rolldown.OutputChunk[]) =>
	list.reduce((sum, chunk) => sum + gzipSync(chunk.code).length, 0);
const holds = (chunk: Rolldown.OutputChunk, pattern: RegExp) =>
	Object.keys(chunk.modules).some((id) => pattern.test(id));
const isDevelop = (chunk: Rolldown.OutputChunk) =>
	holds(chunk, /xrayDevelop\.tsx$/);
const MOTION =
	/node_modules\/.*\/(motion|motion-dom|motion-utils|framer-motion)\//;

test("the kit's main bundle, without React, gzips to 50 kB or less", () => {
	const main = chunks.filter((chunk) => !isDevelop(chunk));
	const develop = chunks.filter(isDevelop);
	// The measured sizes, for the pull request.
	console.info(
		`kit main bundle: ${kb(gzipped(main))} of ${kb(BUDGET)}; X-ray develop, on demand: ${kb(gzipped(develop))}`,
	);

	expect(develop).toHaveLength(1);
	expect(gzipped(main)).toBeLessThanOrEqual(BUDGET);
});

test("Motion is only in the X-ray develop chunk", () => {
	const withMotion = chunks.filter((chunk) => holds(chunk, MOTION));

	expect(withMotion.length).toBeGreaterThan(0);
	for (const chunk of withMotion)
		expect(isDevelop(chunk), chunk.fileName).toBe(true);
});
