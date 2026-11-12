import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { audit, next } from "./api";
import { EngineError } from "./errors";
import { kbArb, referenceVerdict, sessionArb } from "./testkit";
import type { Expr, KnowledgeBase, Question, Session, Verdict } from "./types";

const sessionsArb = kbArb.chain((kb) => sessionArb(kb));

function mentions(expr: Expr, name: string): boolean {
	switch (expr.kind) {
		case "literal":
			return false;
		case "fact":
			return expr.name === name;
		case "unary":
			return mentions(expr.operand, name);
		case "binary":
			return mentions(expr.left, name) || mentions(expr.right, name);
		case "call":
			return expr.args.some((arg) => mentions(arg, name));
	}
}

/** Cites of every rule whose guard or value references `fact`. */
function citesReferencing(kb: KnowledgeBase, fact: string): string[] {
	return kb.rules
		.filter(
			(rule) =>
				mentions(rule.to, fact) ||
				(rule.when !== undefined && mentions(rule.when, fact)),
		)
		.map((rule) => rule.cite);
}

/** Runs the reference interpreter; `undefined` when it hits an evaluation error. */
function reference(session: Session) {
	try {
		return referenceVerdict(session.kb, session.answers);
	} catch (error) {
		if (error instanceof Error && !(error instanceof EngineError)) {
			return undefined;
		}
		throw error;
	}
}

function checkVerdictAgainstReference(session: Session, verdict: Verdict) {
	const ref = reference(session);
	if (ref === undefined) return;
	const { kb } = session;
	expect(Object.keys(verdict.goals)).toEqual([...kb.goals]);
	expect(verdict.goals).toEqual(ref.goals);
	expect(verdict.lineItems).toEqual(ref.lineItems);
	for (const item of verdict.lineItems) {
		const entry = ref.lineItems.find((l) => l.fact === item.fact);
		if (entry !== undefined && entry.value === undefined) {
			expect(item.value).toBeUndefined();
		}
	}
	for (const [name, entry] of Object.entries(ref.goalEntries)) {
		if (entry.status === "inapplicable") {
			expect(verdict.goals[name]).toBeUndefined();
		}
	}
}

function checkQuestion(kb: KnowledgeBase, q: Question) {
	expect(Object.keys(q).sort()).toEqual(
		[
			"kind",
			"fact",
			"text",
			...("why" in q ? ["why"] : []),
			...("clause" in q ? ["clause"] : []),
		].sort(),
	);
	expect(q.kind).toBe("question");
	const def = kb.facts[q.fact];
	expect(def).toBeDefined();
	expect(def?.derived).not.toBe(true);
	expect(q.text).toBe(def?.ask);
	if (def?.why === undefined) {
		expect("why" in q).toBe(false);
	} else {
		expect(q.why).toBe(def.why);
	}
	const cites = citesReferencing(kb, q.fact);
	if ("clause" in q) {
		// The walk reached the fact through a rule: its cite names a clause.
		expect(cites).toContain(q.clause);
		expect(Object.hasOwn(kb.clauses, q.clause as string)).toBe(true);
	} else {
		// Reached without a rule: only a goal is walked to directly.
		expect(kb.goals).toContain(q.fact);
	}
	if (!kb.goals.includes(q.fact)) {
		// A non-goal is only ever reached through a rule that references it.
		expect(cites.length).toBeGreaterThan(0);
		expect("clause" in q).toBe(true);
	}
}

describe("Property 11: Verdicts agree with an independent reference interpreter", () => {
	/**
	 * **Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.10, 5.1, 5.6, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 7.9, 7.10, 7.11**
	 */
	it("audit agrees with the reference interpreter", () => {
		fc.assert(
			fc.property(sessionsArb, (session) => {
				const ref = reference(session);
				if (ref === undefined) {
					expect(() => audit(session.kb, session.answers)).toThrow(EngineError);
					return;
				}
				checkVerdictAgainstReference(
					session,
					audit(session.kb, session.answers),
				);
			}),
			{ numRuns: 200 },
		);
	});

	it("a Verdict from next agrees with the reference interpreter", () => {
		fc.assert(
			fc.property(sessionsArb, (session) => {
				if (reference(session) === undefined) return;
				const out = next(session);
				if (out.kind !== "verdict") return;
				checkVerdictAgainstReference(session, out);
				expect(out.needed).toEqual([]);
			}),
			{ numRuns: 200 },
		);
	});
});

describe("Property 12: Question content comes from the Knowledge_Base", () => {
	/**
	 * **Validates: Requirements 5.2, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8**
	 */
	it("every Question from next is built from the knowledge base", () => {
		fc.assert(
			fc.property(sessionsArb, (session) => {
				if (reference(session) === undefined) return;
				const out = next(session);
				if (out.kind !== "question") return;
				expect(session.answers).not.toHaveProperty(out.fact);
				checkQuestion(session.kb, out);
			}),
			{ numRuns: 200 },
		);
	});

	it("every Question in needed from audit is built from the knowledge base", () => {
		fc.assert(
			fc.property(sessionsArb, (session) => {
				if (reference(session) === undefined) return;
				const verdict = audit(session.kb, session.answers);
				for (const q of verdict.needed) {
					expect(Object.hasOwn(session.answers, q.fact)).toBe(false);
					checkQuestion(session.kb, q);
				}
			}),
			{ numRuns: 200 },
		);
	});
});
