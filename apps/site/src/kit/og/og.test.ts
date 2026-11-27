// @ts-expect-error TS2591: no type definitions for node:fs
import { existsSync, readFileSync, statSync } from "node:fs";
import type { KnowledgeBase } from "@dead-certain/engine";
import { compileText } from "@dead-certain/kb-tools";
import { describe, expect, it } from "vitest";
import { ICONS, PAGES } from "../../../../../packages/ui/src/site";
import { pngFromIco, pngSize } from "../../../../../scripts/og-files";
import { claimKb } from "../../landing/testing/claimKb";
import { type OgKey, ogScenes } from "./ogScenes";

// seo requirements 7.3, 7.4 and 7.7: the committed pictures match the text the
// knowledge bases give today, and have the stated size.
const PUBLIC = new URL("../../../public/", import.meta.url);
const bytes = (path: string): Uint8Array => readFileSync(new URL(path, PUBLIC));

function preflightKb(): KnowledgeBase {
	const file = new URL(
		"../../../../pre-flight/kb/checklist.yaml",
		import.meta.url,
	);
	const result = compileText(
		readFileSync(file, "utf8") as string,
		"checklist.yaml",
	);
	if (!result.ok)
		throw new Error("apps/pre-flight/kb/checklist.yaml does not compile");
	return result.kb;
}

const entries = ogScenes(claimKb(), preflightKb()).entries;
const KEYS = Object.keys(entries) as OgKey[];
const OG_MAX_BYTES = 200_000;

describe("the OG images", () => {
	it("og.json records the text the knowledge bases give today (7.3)", () => {
		const recorded = JSON.parse(
			readFileSync(new URL("og/og.json", PUBLIC), "utf8") as string,
		);
		// A difference means the pictures are stale: run pnpm og and commit them.
		expect(recorded).toEqual(entries);
	});

	it("each page's ogImage and ogAlt are the image's file and alt (7.4)", () => {
		for (const key of KEYS) {
			expect(PAGES[key].ogImage, key).toBe(entries[key].file);
			expect(PAGES[key].ogAlt, key).toBe(entries[key].alt);
			expect(entries[key].alt.length, key).toBeLessThanOrEqual(125);
		}
	});

	it("each image is a 1200 by 630 PNG under 200 kB (7.1, 7.7)", () => {
		for (const key of KEYS) {
			const file = entries[key].file;
			expect(pngSize(bytes(file)), file).toEqual({ width: 1200, height: 630 });
			expect(statSync(new URL(file, PUBLIC)).size, file).toBeLessThan(
				OG_MAX_BYTES,
			);
		}
	});
});

describe("the icons (7.5)", () => {
	const local = (href: string) => href.replace(/^\/dead-certain\//, "");

	it("the PNGs have the size their name or manifest entry states", () => {
		expect(pngSize(bytes(local(ICONS.appleTouch)))).toEqual({
			width: 180,
			height: 180,
		});
		for (const icon of ICONS.manifest) {
			const [w, h] = icon.sizes.split("x").map(Number);
			expect(pngSize(bytes(local(icon.src))), icon.src).toEqual({
				width: w,
				height: h,
			});
		}
	});

	it("favicon.ico holds one 32 px PNG", () => {
		const { png, size } = pngFromIco(bytes(local(ICONS.favicon)));
		expect(size).toBe(32);
		expect(pngSize(png)).toEqual({ width: 32, height: 32 });
		expect(existsSync(new URL(local(ICONS.favicon), PUBLIC))).toBe(true);
	});
});
