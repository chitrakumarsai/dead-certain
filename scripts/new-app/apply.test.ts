import { describe, expect, it } from "vitest";
import { apply } from "./apply.ts";
import type { Plan } from "./plan.ts";
import { MemoryFs } from "./testing-fs.ts";

const PLAN: Plan = {
	name: "loan-check",
	title: "Loan Check",
	slugConst: "LOAN_CHECK",
	port: 4176,
	url: "http://localhost:4176/dead-certain/loan-check/",
	create: [
		{ path: "apps/loan-check/package.json", text: "{}" },
		{ path: "apps/loan-check/src/main.tsx", text: "main" },
		{ path: "apps/loan-check/src/session/store.ts", text: "store" },
		{ path: "e2e/loan-check-smoke.spec.ts", text: "smoke" },
	],
	edits: [
		{
			path: "playwright.config.ts",
			before: "pw before",
			after: "pw after",
			inserted: [],
		},
		{
			path: ".github/workflows/ci.yml",
			before: "ci before",
			after: "ci after",
			inserted: [],
		},
		{
			path: "packages/ui/src/site.ts",
			before: "site before",
			after: "site after",
			inserted: [],
		},
	],
};
const SEED = {
	"playwright.config.ts": "pw before",
	".github/workflows/ci.yml": "ci before",
	"packages/ui/src/site.ts": "site before",
	"e2e/kit.spec.ts": "kit",
};

describe("apply", () => {
	it("writes every file and the three edits", () => {
		const fs = new MemoryFs(SEED);
		expect(apply(PLAN, fs)).toEqual({ ok: true });
		for (const f of PLAN.create) expect(fs.files.get(f.path)).toBe(f.text);
		expect(fs.files.get("playwright.config.ts")).toBe("pw after");
		expect(fs.files.get(".github/workflows/ci.yml")).toBe("ci after");
		expect(fs.files.get("packages/ui/src/site.ts")).toBe("site after");
		expect(fs.dirs.has("apps/loan-check/src/session")).toBe(true);
	});

	// Every write is failed in turn, the site.ts edit's included (13.6).
	it("leaves the file system as it began when any write fails (2.6)", () => {
		const total = (() => {
			const fs = new MemoryFs(SEED);
			apply(PLAN, fs);
			return fs.writes;
		})();
		for (let n = 1; n <= total; n++) {
			const fs = new MemoryFs(SEED, n);
			const before = fs.snapshot();
			const r = apply(PLAN, fs);
			expect(r.ok, `write ${n}`).toBe(false);
			expect(fs.files, `write ${n}`).toEqual(before.files);
			expect(fs.dirs, `write ${n}`).toEqual(before.dirs);
		}
	});

	it("refuses to overwrite a file that exists, and changes nothing (2.7)", () => {
		const fs = new MemoryFs({
			...SEED,
			"apps/loan-check/src/main.tsx": "mine",
		});
		const before = fs.snapshot();
		expect(apply(PLAN, fs).ok).toBe(false);
		expect(fs.files).toEqual(before.files);
	});
});
