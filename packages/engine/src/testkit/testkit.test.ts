import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { audit } from "../api";
import { validateAnswers, validateKb } from "../check";
import { EngineError } from "../errors";
import type { KnowledgeBase } from "../types";
import { UNKNOWN } from "../types";
import {
	askableFacts,
	assignments,
	cyclicKbArb,
	deepFreeze,
	isReadOnceKb,
	kbArb,
	readOnceKbArb,
	referenceVerdict,
	sessionArb,
	walkPublic,
} from "./index";

describe("testkit generators", () => {
	it("generated knowledge bases pass validateKb and stay within size limits", () => {
		fc.assert(
			fc.property(kbArb, (kb) => {
				validateKb(kb);
				expect(Object.keys(kb.facts).length).toBeLessThanOrEqual(30);
				expect(kb.rules.length).toBeLessThanOrEqual(60);
				for (const rule of kb.rules) {
					expect(kb.clauses[rule.cite]).toBeDefined();
				}
			}),
			{ numRuns: 100 },
		);
	});

	it("cyclic knowledge bases fail validateKb with CYCLE", () => {
		fc.assert(
			fc.property(cyclicKbArb, (kb) => {
				try {
					validateKb(kb);
				} catch (error) {
					if (!(error instanceof EngineError)) throw error;
					expect(error.code).toBe("CYCLE");
					return;
				}
				throw new Error("expected a CYCLE error");
			}),
			{ numRuns: 100 },
		);
	});

	it("generated sessions pass validateAnswers and only answer askable facts", () => {
		fc.assert(
			fc.property(
				kbArb.chain((kb) => sessionArb(kb)),
				(session) => {
					validateAnswers(session.kb, session.answers);
					const askable = new Set(askableFacts(session.kb));
					for (const name of Object.keys(session.answers)) {
						expect(askable.has(name)).toBe(true);
					}
				},
			),
			{ numRuns: 100 },
		);
	});

	it("generated sessions evaluate without engine errors and reach unknown goals", () => {
		let undefinedGoals = 0;
		let decidedGoals = 0;
		fc.assert(
			fc.property(
				kbArb.chain((kb) => sessionArb(kb)),
				(session) => {
					const verdict = audit(session.kb, session.answers);
					for (const value of Object.values(verdict.goals)) {
						if (value === undefined) undefinedGoals++;
						else decidedGoals++;
					}
				},
			),
			{ numRuns: 200 },
		);
		expect(undefinedGoals).toBeGreaterThan(0);
		expect(decidedGoals).toBeGreaterThan(0);
	});
});

describe("deepFreeze", () => {
	it("freezes nested objects and arrays", () => {
		const value = deepFreeze({ a: { b: [1, { c: 2 }] } });
		expect(Object.isFrozen(value.a)).toBe(true);
		expect(Object.isFrozen(value.a.b)).toBe(true);
		expect(Object.isFrozen(value.a.b[1])).toBe(true);
	});
});

describe("walkPublic", () => {
	it("accepts plain JSON with undefined properties", () => {
		expect(walkPublic({ a: [1, "x", true], b: undefined }, "next")).toBe(
			undefined,
		);
	});

	it("reports the path of a symbol", () => {
		expect(walkPublic({ goals: { f1: UNKNOWN } }, "audit")).toEqual({
			path: "audit.goals.f1",
			reason: "symbol",
		});
	});

	it("reports array indexes, NaN, null, undefined elements and bad prototypes", () => {
		expect(walkPublic({ a: [1, Number.NaN] }, "r")?.path).toBe("r.a[1]");
		expect(walkPublic({ a: null }, "r")?.path).toBe("r.a");
		expect(walkPublic([undefined], "r")?.path).toBe("r[0]");
		expect(walkPublic({ a: new Date(0) }, "r")?.path).toBe("r.a");
		expect(walkPublic({ a: Object.create(null) }, "r")?.path).toBe("r.a");
	});
});

describe("oracles", () => {
	it("referenceVerdict agrees with audit on goals and line items", () => {
		fc.assert(
			fc.property(
				kbArb.chain((kb) => sessionArb(kb)),
				(session) => {
					const ref = referenceVerdict(session.kb, session.answers);
					const verdict = audit(session.kb, session.answers);
					expect(ref.goals).toEqual(verdict.goals);
					expect(ref.lineItems).toEqual(verdict.lineItems);
				},
			),
			{ numRuns: 100 },
		);
	});

	it("assignments enumerates every combination of unanswered facts", () => {
		const kb: KnowledgeBase = {
			id: "t",
			goals: ["g"],
			facts: {
				a: { type: "boolean", ask: "a?" },
				b: { type: "enum", ask: "b?", options: ["x", "y", "z"] },
				c: { type: "boolean", ask: "c?" },
				g: { type: "boolean", derived: true },
			},
			rules: [],
			clauses: {},
		};
		const all = assignments(kb, { c: true });
		expect(all).toHaveLength(6);
		expect(new Set(all.map((x) => JSON.stringify(x))).size).toBe(6);
		expect(all.every((x) => x.c === true && "a" in x && "b" in x)).toBe(true);
		expect(assignments(kb, { a: true, b: "x", c: false })).toEqual([
			{ a: true, b: "x", c: false },
		]);
	});

	it("isReadOnceKb rejects dead rules and self-cancelling expressions", () => {
		const base = (
			when: KnowledgeBase["rules"][number]["when"],
		): KnowledgeBase => ({
			id: "t",
			goals: ["g"],
			facts: {
				a: { type: "boolean", ask: "a?" },
				g: { type: "boolean", derived: true },
			},
			rules: [
				{
					id: "r0",
					cite: "c",
					set: "g",
					to: { kind: "literal", type: "boolean", value: true },
					when,
					because: "b",
				},
				{
					id: "r1",
					cite: "c",
					set: "g",
					to: { kind: "literal", type: "boolean", value: false },
					because: "b",
				},
			],
			clauses: { c: { id: "c", title: "C", text: "T" } },
		});
		const a = { kind: "fact", name: "a" } as const;
		expect(isReadOnceKb(base(a))).toBe(true);
		// a or not a is constant: rule r0 always fires and r1 is dead
		expect(
			isReadOnceKb(
				base({
					kind: "binary",
					op: "or",
					left: a,
					right: { kind: "unary", op: "not", operand: a },
				}),
			),
		).toBe(false);
	});

	it("readOnceKbArb yields valid read-once boolean and enum knowledge bases", () => {
		fc.assert(
			fc.property(readOnceKbArb, (kb) => {
				validateKb(kb);
				expect(isReadOnceKb(kb)).toBe(true);
				expect(kb.goals.length).toBeGreaterThan(0);
				expect(assignments(kb, {}).length).toBeLessThanOrEqual(6561);
			}),
			{ numRuns: 100 },
		);
	});
});
