import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { apply } from "./apply.ts";
import type { Plan } from "./plan.ts";
import { MemoryFs } from "./testing-fs.ts";

describe("apply properties", () => {
	it("a failed apply leaves nothing behind", () => {
		// Feature: app-template, Property 6: A failed apply leaves nothing behind
		const pathArb = fc
			.array(fc.constantFrom("src", "kb", "a", "b.ts", "c.json", "session"), {
				minLength: 1,
				maxLength: 3,
			})
			.map((p) => `apps/probe/${p.join("/")}`);
		fc.assert(
			fc.property(
				fc.uniqueArray(pathArb, { minLength: 1, maxLength: 6 }),
				fc.integer({ min: 1, max: 40 }),
				(paths, failAt) => {
					// A file path must not also be a directory of another.
					const files = paths.filter(
						(p) => !paths.some((q) => q.startsWith(`${p}/`)),
					);
					const plan: Plan = {
						name: "probe",
						title: "Probe",
						slugConst: "PROBE",
						port: 4176,
						url: "",
						create: files.map((path) => ({ path, text: path })),
						edits: [
							{
								path: "playwright.config.ts",
								before: "b",
								after: "a",
								inserted: [],
							},
						],
					};
					const fs = new MemoryFs({ "playwright.config.ts": "b" }, failAt);
					const before = fs.snapshot();
					const r = apply(plan, fs);
					if (!r.ok) {
						expect(fs.files).toEqual(before.files);
						expect(fs.dirs).toEqual(before.dirs);
					} else for (const f of files) expect(fs.files.get(f)).toBe(f);
				},
			),
			{ numRuns: 300 },
		);
	});
});
