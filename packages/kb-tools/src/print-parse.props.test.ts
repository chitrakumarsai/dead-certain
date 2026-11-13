import { type Expr, parse, print } from "@dead-certain/engine";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { compileText } from "./index";
import { kbArb, renderYaml } from "./testkit";

const FILE = "apps/demo/kb/demo.yaml";

describe("Property 6: printing and parsing compiled expressions is the identity", () => {
	/** **Validates: Requirements 15.11** */
	it("parse(print(e)) equals e for every compiled expression", () => {
		fc.assert(
			fc.property(kbArb, (k) => {
				const r = compileText(renderYaml(k), FILE);
				expect(r.ok).toBe(true);
				if (!r.ok) return;
				const exprs: Expr[] = [];
				for (const rule of r.kb.rules) {
					exprs.push(rule.to);
					if (rule.when !== undefined) exprs.push(rule.when);
				}
				for (const e of exprs) {
					const back = parse(print(e));
					expect(back.ok).toBe(true);
					if (back.ok) expect(back.expr).toEqual(e);
				}
			}),
			{ numRuns: 200 },
		);
	});
});
