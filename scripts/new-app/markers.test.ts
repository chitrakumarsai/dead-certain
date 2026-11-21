// @ts-expect-error TS2591: no type definitions for node:fs
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { insertAtMarker, nextPort } from "./markers.ts";

const read = (p: string) =>
	readFileSync(new URL(`../../${p}`, import.meta.url), "utf8") as string;
const PLAYWRIGHT = read("playwright.config.ts");
const CI = read(".github/workflows/ci.yml");

describe("insertAtMarker", () => {
	it("inserts before the marker line, with its indentation, and changes nothing else (6.1 to 6.4)", () => {
		const r = insertAtMarker(CI, "dc-build", [
			"- run: pnpm dc build apps/loan-check",
		]);
		if (!r.ok) throw new Error(r.message);
		expect(r.text).toContain(
			"      - run: pnpm dc build apps/loan-check\n      # new-app:dc-build\n",
		);
		expect(
			r.text.replace("      - run: pnpm dc build apps/loan-check\n", ""),
		).toBe(CI);
	});

	it("inserts several lines as one unit under one marker", () => {
		const r = insertAtMarker(PLAYWRIGHT, "servers", ["{", "\turl: X,", "},"]);
		if (!r.ok) throw new Error(r.message);
		expect(r.text).toContain(
			"\t\t{\n\t\t\turl: X,\n\t\t},\n\t\t// new-app:servers\n",
		);
	});

	it("refuses a missing marker and a doubled one, naming it (2.4)", () => {
		expect(insertAtMarker("no markers here\n", "urls", ["x"])).toEqual({
			ok: false,
			message: "The marker new-app:urls is missing.",
		});
		const twice = `${CI}      # new-app:copy\n`;
		expect(insertAtMarker(twice, "copy", ["x"])).toEqual({
			ok: false,
			message: "The marker new-app:copy appears more than once.",
		});
	});

	it("keeps Windows line endings", () => {
		const crlf = "a\r\n  # new-app:copy\r\nb\r\n";
		const r = insertAtMarker(crlf, "copy", ["- run: x"]);
		expect(r).toEqual({
			ok: true,
			text: "a\r\n  - run: x\r\n  # new-app:copy\r\nb\r\n",
		});
	});
});

describe("nextPort", () => {
	it("gives one more than the highest localhost port (6.5)", () => {
		const text = `const A = "http://localhost:4173/";\nconst B = "http://localhost:4175/";\n  preview --port 4174`;
		expect(nextPort(text)).toBe(4176);
		// The real file: above every port it names, whichever apps exist.
		const ports = [...PLAYWRIGHT.matchAll(/localhost:(\d+)/g)].map((m) =>
			Number(m[1]),
		);
		expect(nextPort(PLAYWRIGHT)).toBe(Math.max(...ports) + 1);
	});

	it("gives 4174 when there is none", () => {
		expect(nextPort("export default {};")).toBe(4174);
	});
});
