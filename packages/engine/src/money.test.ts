import { describe, expect, it } from "vitest";
import { EngineError } from "./errors";
import { parse } from "./lang/parse";
import { Resolver } from "./resolve";
import type { FactValue, KnowledgeBase, Rule } from "./types";
import { UNKNOWN } from "./types";

function expr(src: string) {
	const r = parse(src);
	if (!r.ok) throw new Error(`parse failed: ${r.error.message}`);
	return r.expr;
}

function rule(id: string, set: string, to: string, when?: string): Rule {
	return {
		id,
		cite: "c1",
		set,
		to: expr(to),
		...(when === undefined ? {} : { when: expr(when) }),
		because: "because",
	};
}

function kb(rules: Rule[]): KnowledgeBase {
	return {
		id: "money-kb",
		goals: ["fee"],
		facts: {
			sum_insured: { type: "money", ask: "Sum insured?" },
			flag: { type: "boolean", ask: "Flag?" },
			fee: { type: "money", derived: true },
		},
		rules,
		clauses: { c1: { id: "c1", title: "Clause", text: "Text" } },
	};
}

function resolve(rules: Rule[], answers: Record<string, FactValue>) {
	return new Resolver(kb(rules), answers).fact("fee");
}

function thrown(fn: () => unknown): EngineError {
	try {
		fn();
	} catch (e) {
		expect(e).toBeInstanceOf(EngineError);
		return e as EngineError;
	}
	throw new Error("expected an EngineError");
}

describe("NON_INTEGER_MONEY", () => {
	it("throws, naming the rule id and the fact, for a fractional money result", () => {
		const err = thrown(() =>
			resolve([rule("r_fee", "fee", "sum_insured * 0.01")], {
				sum_insured: 150,
			}),
		);
		expect(err.code).toBe("NON_INTEGER_MONEY");
		expect(err.message).toContain("r_fee");
		expect(err.message).toContain("fee");
	});

	it("succeeds with an integer when the same rule uses round(...)", () => {
		const res = resolve([rule("r_fee", "fee", "round(sum_insured * 0.01)")], {
			sum_insured: 150,
		});
		expect(res.status).toBe("known");
		expect(res.value).toBe(2);
		expect(Number.isInteger(res.value)).toBe(true);
	});

	it("accepts a fractional-looking rule that yields an integer", () => {
		const res = resolve([rule("r_fee", "fee", "sum_insured * 0.01")], {
			sum_insured: 200,
		});
		expect(res.value).toBe(2);
	});

	it("throws no error when the deciding `to` value is Unknown", () => {
		const res = resolve([rule("r_fee", "fee", "sum_insured * 0.01")], {});
		expect(res.status).toBe("unknown");
		expect(res.value).toBe(UNKNOWN);
		expect(res.deciding?.id).toBe("r_fee");
	});

	it("throws no error when the guard is unmatched", () => {
		const res = resolve([rule("r_fee", "fee", "sum_insured * 0.01", "flag")], {
			sum_insured: 150,
			flag: false,
		});
		expect(res.status).toBe("inapplicable");
	});

	it("ignores a fractional rule that is skipped by a false guard", () => {
		const res = resolve(
			[
				rule("r_skip", "fee", "sum_insured * 0.01", "flag"),
				rule("r_fee", "fee", "round(sum_insured * 0.01)"),
			],
			{ sum_insured: 150, flag: false },
		);
		expect(res.status).toBe("known");
		expect(res.value).toBe(2);
		expect(res.deciding?.id).toBe("r_fee");
	});

	it("ignores a fractional rule that is not reached after an earlier decision", () => {
		const res = resolve(
			[
				rule("r_first", "fee", "round(sum_insured * 0.01)"),
				rule("r_later", "fee", "sum_insured * 0.01"),
			],
			{ sum_insured: 150 },
		);
		expect(res.value).toBe(2);
		expect(res.deciding?.id).toBe("r_first");
	});

	it("does not reach a fractional rule behind an Unknown guard", () => {
		const res = resolve(
			[
				rule("r_unk", "fee", "round(sum_insured)", "flag"),
				rule("r_later", "fee", "sum_insured * 0.01"),
			],
			{ sum_insured: 150 },
		);
		expect(res.status).toBe("unknown");
	});
});
