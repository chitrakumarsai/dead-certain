import { expect, test } from "vitest";
import { icoFromPng, pngFromIco, pngSize } from "./og-files.ts";

/** The 24 bytes pngSize reads: signature, IHDR length and type, width, height. */
function header(width: number, height: number): Uint8Array {
	const out = new Uint8Array(33);
	out.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]);
	out.set([0x49, 0x48, 0x44, 0x52], 12);
	const view = new DataView(out.buffer);
	view.setUint32(16, width);
	view.setUint32(20, height);
	return out;
}

test("pngSize reads the header and refuses anything else", () => {
	expect(pngSize(header(1200, 630))).toEqual({ width: 1200, height: 630 });
	expect(() => pngSize(new Uint8Array(33))).toThrow("not a PNG");
	const bad = header(1, 1);
	bad[12] = 0x58;
	expect(() => pngSize(bad)).toThrow("IHDR");
});

test("an ICO round-trips its PNG and states its size", () => {
	const png = header(32, 32);
	const ico = icoFromPng(png, 32);
	expect([...ico.subarray(0, 6)]).toEqual([0, 0, 1, 0, 1, 0]);
	expect(pngFromIco(ico)).toEqual({ png, size: 32 });
	expect(pngFromIco(icoFromPng(header(256, 256), 256)).size).toBe(256);
	expect(() => pngFromIco(png)).toThrow("not an ICO");
});
