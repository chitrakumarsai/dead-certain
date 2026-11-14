/// <reference types="vite/client" />
import { describe, expect, it } from "vitest";

// The project has no Node type definitions, so both files are read through
// Vite's build-time glob instead of node:fs.
const docs: Record<string, string> = import.meta.glob(
	"../../../docs/kb-format.md",
	{ eager: true, query: "?raw", import: "default" },
);
const sources: Record<string, string> = import.meta.glob("./diagnostics.ts", {
	eager: true,
	query: "?raw",
	import: "default",
});

type Sev = "error" | "warning";

/** Codes in a union type of diagnostics.ts, from the source text. */
function union(name: string): string[] {
	const source = sources["./diagnostics.ts"] ?? "";
	const start = source.indexOf(`export type ${name} =`);
	expect(start).toBeGreaterThanOrEqual(0);
	const end = source.indexOf(";", start);
	return [...source.slice(start, end).matchAll(/"([A-Z_]+)"/g)].map(
		(m) => m[1] as string,
	);
}

interface DocRow {
	readonly code: string;
	readonly severity: string;
	readonly id: string;
	readonly example: string;
}

/** Rows of the table in the "Diagnostic codes" section of docs/kb-format.md. */
function catalogueRows(): DocRow[] {
	const text = docs["../../../docs/kb-format.md"] ?? "";
	const start = text.indexOf("\n## Diagnostic codes");
	expect(start).toBeGreaterThanOrEqual(0);
	const rest = text.slice(start + 1);
	const next = rest.indexOf("\n## ", 1);
	const section = next < 0 ? rest : rest.slice(0, next);
	const rows: DocRow[] = [];
	for (const line of section.split("\n")) {
		const m = /^\| `([A-Z_]+)` \| (\w+) \| (.+?) \| (.+) \|$/.exec(line);
		if (m) {
			rows.push({
				code: m[1] as string,
				severity: m[2] as string,
				id: m[3] as string,
				example: m[4] as string,
			});
		}
	}
	return rows;
}

describe("Diagnostic codes catalogue in docs/kb-format.md", () => {
	const errors = union("ErrorCode");
	const warnings = union("WarningCode");
	const expected = new Map<string, Sev>([
		...errors.map((c): [string, Sev] => [c, "error"]),
		...warnings.map((c): [string, Sev] => [c, "warning"]),
	]);
	const rows = catalogueRows();

	it("diagnostics.ts declares 23 codes: 21 errors and 2 warnings", () => {
		expect(errors).toHaveLength(21);
		expect(warnings).toHaveLength(2);
		expect(expected.size).toBe(23);
	});

	it("lists exactly the codes of diagnostics.ts, each once", () => {
		const listed = rows.map((r) => r.code);
		expect(listed).toHaveLength(23);
		expect(new Set(listed).size).toBe(23);
		expect([...listed].sort()).toEqual([...expected.keys()].sort());
	});

	it("gives every code the severity diagnostics.ts gives it", () => {
		for (const r of rows) {
			expect({ code: r.code, severity: r.severity }).toEqual({
				code: r.code,
				severity: expected.get(r.code),
			});
		}
	});

	it("gives every code an id description and an example message", () => {
		for (const r of rows) {
			expect(r.id.trim().length).toBeGreaterThan(0);
			expect(r.example.trim().length).toBeGreaterThan(0);
		}
	});
});
