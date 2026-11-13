import { type Env, evaluate, type KnowledgeBase } from "@dead-certain/engine";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { validateText } from "./index";
import { answersArb, kbArb, renderYaml } from "./testkit";

const FILE = "apps/demo/kb/demo.yaml";

/** A knowledge base with an environment of type-valid values; some facts are left unknown. */
const kbAndEnvArb = kbArb.chain((kb) => {
	// Every fact, derived ones included, may hold a type-valid value or be unknown.
	const asAskable: KnowledgeBase = {
		...kb,
		facts: Object.fromEntries(
			Object.entries(kb.facts).map(([name, def]) => {
				const { derived: _derived, ...rest } = def;
				return [name, rest];
			}),
		),
	};
	return answersArb(asAskable, { partial: true }).map((values) => {
		// A null-prototype environment, so a fact named `constructor` is simply absent.
		const env: Record<string, unknown> = Object.create(null);
		for (const [name, value] of Object.entries(values)) env[name] = value;
		return { kb, env: env as Env };
	});
});

describe("Property 9: A type-checked expression never fails the engine's type checks", () => {
	// Feature: kb-tools, Property 9: A type-checked expression never fails the engine's type checks
	// **Validates: Requirements 10.1, 10.12, 11.1, 11.2**
	it("gives well-typed generated expressions no type diagnostic", () => {
		fc.assert(
			fc.property(kbArb, (kb) => {
				const typeDiagnostics = validateText(
					renderYaml(kb),
					FILE,
				).diagnostics.filter(
					(d) => d.code === "TYPE_MISMATCH" || d.code === "NOT_BOOLEAN",
				);
				expect(typeDiagnostics).toEqual([]);
			}),
			{ numRuns: 200 },
		);
	});

	it("never returns TYPE_MISMATCH from evaluate; only DIVISION_BY_ZERO and NUMERIC_OVERFLOW may occur", () => {
		fc.assert(
			fc.property(kbAndEnvArb, ({ kb, env }) => {
				const typeDiagnostics = validateText(
					renderYaml(kb),
					FILE,
				).diagnostics.filter(
					(d) => d.code === "TYPE_MISMATCH" || d.code === "NOT_BOOLEAN",
				);
				// The premise: the validator accepts the knowledge base on types.
				fc.pre(typeDiagnostics.length === 0);
				for (const rule of kb.rules) {
					const exprs =
						rule.when === undefined ? [rule.to] : [rule.to, rule.when];
					for (const expr of exprs) {
						const result = evaluate(expr, env);
						if (!result.ok) {
							expect(["DIVISION_BY_ZERO", "NUMERIC_OVERFLOW"]).toContain(
								result.error.code,
							);
						}
					}
				}
			}),
			{ numRuns: 300 },
		);
	});
});
