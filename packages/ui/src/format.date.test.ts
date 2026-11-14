// @ts-expect-error TS2591: no type definitions for node:fs
import { readdirSync, readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { formatDate } from "./format/value";

// Feature: ui-kit, Property 4: Date formatting never uses local time
// A plain unit test plus a source scan, as the design specifies.

test.each([
	["2026-01-01", "1 Jan 2026"],
	["2026-01-31", "31 Jan 2026"],
	["2026-02-28", "28 Feb 2026"],
	["2024-02-29", "29 Feb 2024"],
	["2026-03-01", "1 Mar 2026"],
	["2026-04-30", "30 Apr 2026"],
	["2026-06-30", "30 Jun 2026"],
	["2026-10-31", "31 Oct 2026"],
	["2026-12-31", "31 Dec 2026"],
	["1999-12-31", "31 Dec 1999"],
	["2000-01-01", "1 Jan 2000"],
])("formatDate(%j) names the same calendar day: %s", (iso, expected) => {
	expect(formatDate(iso)).toBe(expected);
});

test("the printed day, month and year always match the ISO string", () => {
	for (const iso of ["2026-01-01", "2024-02-29", "2026-12-31", "2026-07-15"]) {
		const [year, month, day] = iso.split("-").map(Number);

		const parts = new Intl.DateTimeFormat("en-IN", {
			dateStyle: "medium",
			timeZone: "UTC",
		}).formatToParts(new Date(`${iso}T00:00:00Z`));
		const printed = formatDate(iso);

		expect(printed).toContain(String(day));
		expect(printed).toContain(String(year));
		expect(printed).toContain(
			parts.find((part) => part.type === "month")?.value as string,
		);
		expect(month).toBeGreaterThan(0);
	}
});

const LOCAL_TIME = [
	/new Date\([^)]*,/, // new Date(y, m, d)
	/new Date\((?![^)]*Z)[^)]+\)/, // new Date(something) with no Z
	/\.getDate\(/,
	/\.getMonth\(/,
	/\.getFullYear\(/,
	/\.getHours\(/,
];

test("the scan recognises each local-time pattern and passes the UTC form", () => {
	const bad = [
		"new Date(2026, 0, 1)",
		"new Date(iso)",
		"new Date(iso + 'T00:00:00')",
		"d.getDate()",
		"d.getMonth()",
		"d.getFullYear()",
		"d.getHours()",
	];

	for (const line of bad) {
		expect(
			LOCAL_TIME.some((p) => p.test(line)),
			line,
		).toBe(true);
	}
	expect(LOCAL_TIME.some((p) => p.test("new Date(iso + 'T00:00:00Z')"))).toBe(
		false,
	);
});

test("the format module has no local-time constructor or getter", () => {
	const dir = new URL("./format/", import.meta.url);
	const files = readdirSync(dir) as string[];

	const offenders = files.flatMap((file) =>
		(readFileSync(new URL(file, dir), "utf8") as string)
			.split("\n")
			.filter((line) => LOCAL_TIME.some((p) => p.test(line)))
			.map((line) => `${file}: ${line.trim()}`),
	);

	expect(files.length).toBeGreaterThanOrEqual(3);
	expect(offenders).toEqual([]);
});
