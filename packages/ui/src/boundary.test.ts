// @ts-expect-error TS2591: no type definitions for node:fs
import { readdirSync, readFileSync } from "node:fs";
import { expect, test } from "vitest";

// Feature: ui-kit, Property 13: No runtime engine import

interface ImportStatement {
	readonly isTypeOnly: boolean;
	readonly from: string;
}

/** Every import, re-export and dynamic import in a source file, multi-line included. */
function importsOf(source: string): ImportStatement[] {
	const statements = [
		...source.matchAll(
			/\b(?:import|export)\b(\s+type\b)?[^;'"`]*?\bfrom\s*["']([^"']+)["']/g,
		),
	].map((m) => ({ isTypeOnly: Boolean(m[1]), from: m[2] as string }));
	const bare = [...source.matchAll(/^\s*import\s*["']([^"']+)["']/gm)].map(
		(m) => ({ isTypeOnly: false, from: m[1] as string }),
	);
	const dynamic = [
		...source.matchAll(/\bimport\(\s*["']([^"']+)["']\s*\)/g),
	].map((m) => ({ isTypeOnly: false, from: m[1] as string }));
	return [...statements, ...bare, ...dynamic];
}

const isEngine = (from: string): boolean =>
	from === "@dead-certain/engine" || from.startsWith("@dead-certain/engine/");
const isMotion = (from: string): boolean =>
	from === "motion" || from.startsWith("motion/");

// The X-ray develop is the kit's only use of Motion; XrayStage loads it on demand.
const XRAY_STAGE = "components/xrayDevelop.tsx";

/** Why a file breaks the kit's import boundary, one line per breach. */
function breaches(file: string, source: string): string[] {
	const found = importsOf(source).flatMap((statement) => {
		if (isEngine(statement.from)) {
			if (!statement.isTypeOnly) return [`value import from ${statement.from}`];
			if (statement.from !== "@dead-certain/engine/types") {
				return [`type import from ${statement.from}, not engine/types`];
			}
		}
		if (isMotion(statement.from) && file !== XRAY_STAGE) {
			return [`motion imported outside ${XRAY_STAGE}`];
		}
		return [];
	});
	return source.includes("dangerouslySetInnerHTML")
		? [...found, "dangerouslySetInnerHTML"]
		: found;
}

test.each([
	['import { start } from "@dead-certain/engine";', "value import"],
	[
		'import { type Verdict } from "@dead-certain/engine/types";',
		"value import",
	],
	[
		'import type { ErrorCode } from "@dead-certain/engine";',
		"not engine/types",
	],
	['export { start } from "@dead-certain/engine";', "value import"],
	['const engine = await import("@dead-certain/engine");', "value import"],
	['import "@dead-certain/engine";', "value import"],
	[
		'import {\n\tanswer,\n\tnext,\n} from "@dead-certain/engine";',
		"value import",
	],
	['import { m } from "motion/react";', "motion imported outside"],
	["<p dangerouslySetInnerHTML={{ __html: x }} />", "dangerouslySetInnerHTML"],
])("the scan catches %j", (source, reason) => {
	expect(breaches("components/Ledger.tsx", source).join()).toContain(reason);
});

test("the scan allows a type import from engine/types and motion in the X-ray develop", () => {
	expect(
		breaches(
			"components/Ledger.tsx",
			'import type { Verdict } from "@dead-certain/engine/types";',
		),
	).toEqual([]);
	expect(
		breaches(XRAY_STAGE, 'import { LazyMotion, m } from "motion/react";'),
	).toEqual([]);
});

test("no kit source file crosses the import boundary", () => {
	const src = new URL("./", import.meta.url);
	const files = (readdirSync(src, { recursive: true }) as string[])
		.map((file) => file.replaceAll("\\", "/"))
		.filter((file) => /\.tsx?$/.test(file) && !/\.test\.tsx?$/.test(file));

	const found = files.flatMap((file) =>
		breaches(file, readFileSync(new URL(file, src), "utf8")).map(
			(reason) => `${file}: ${reason}`,
		),
	);

	expect(files).toEqual(expect.arrayContaining(["fixtures.ts", "types.ts"]));
	expect(found).toEqual([]);
});
