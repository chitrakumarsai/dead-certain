// Property 3: Sound proofs (Requirements 9 and 16).
//
// For every generated Session and every goal or line-item fact, the tree from
// `explain` is checked node by node:
//   - the root value equals the Verdict's value and the reference value;
//   - a derived node with a deciding rule re-evaluates (rule language
//     `evaluate`, environment built from the children's values) to its own
//     value, its `when` holds and every earlier rule's guard is false;
//   - a leaf equals the session answer; clauses exist and equal the rule's
//     `cite`; no `{fact}` placeholder survives in `because`; a derived node
//     without a deciding rule is bare and Unknown.
// Skipped_Branch children (Requirements 9.14, 9.16, 16.11, 16.12): a node
// whose resolution raises an error must be bare; any other node satisfies
// every check in full, including the reference value.
//
// Known limit (shared with `referenceVerdict`): the per-node oracle treats a
// fact whose own inputs fail as Unknown rather than as an error, so error
// knowledge bases keep the failing fact's error direct (`10 / z`).

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { audit, explain, next } from "./api";
import { EngineError } from "./errors";
import { evaluate } from "./lang/evaluate";
import { parse } from "./lang/parse";
import { kbArb, referenceVerdict, sessionArb, walkPublic } from "./testkit";
import type {
	Expr,
	FactValue,
	KnowledgeBase,
	ProofNode,
	Rule,
	Session,
	Verdict,
} from "./types";
import { UNKNOWN } from "./types";

const NUM_RUNS = 100;
const TEST_TIMEOUT_MS = 30_000;

/**
 * Bounded so that a failing property reports cleanly: an interrupt cap on total time (shrinking included), a
 * wall-clock cap, and no further runs once a failure is found.
 */
const PARAMS: fc.Parameters<unknown> = {
	numRuns: NUM_RUNS,
	endOnFailure: true,
	interruptAfterTimeLimit: 20_000,
};

const generalSessionArb = kbArb.chain((kb) => sessionArb(kb));

// ─── Helpers ────────────────────────────────────────────────────────────────

function errorCodeOf(fn: () => unknown): string | undefined {
	try {
		fn();
	} catch (error) {
		if (error instanceof EngineError) return error.code;
		throw error;
	}
	return undefined;
}

function refsOf(expr: Expr, into: Set<string>): void {
	switch (expr.kind) {
		case "literal":
			return;
		case "fact":
			into.add(expr.name);
			return;
		case "unary":
			refsOf(expr.operand, into);
			return;
		case "binary":
			refsOf(expr.left, into);
			refsOf(expr.right, into);
			return;
		case "call":
			for (const arg of expr.args) refsOf(arg, into);
			return;
	}
}

function publicOf(value: FactValue | typeof UNKNOWN): FactValue | undefined {
	if (value === UNKNOWN) return undefined;
	return value === 0 ? 0 : value;
}

function countNodes(node: ProofNode): number {
	return 1 + node.children.reduce((n, c) => n + countNodes(c), 0);
}

function depthOf(node: ProofNode): number {
	return 1 + Math.max(0, ...node.children.map(depthOf));
}

interface Oracle {
	/** True when the reference interpreter hits an evaluation error on `fact`. */
	readonly errors: boolean;
	readonly value: FactValue | undefined;
}

/** Reference result for one fact: a one-goal copy of the KB with no line-item roles. */
function oracleFor(
	kb: KnowledgeBase,
	answers: Readonly<Record<string, FactValue>>,
): (fact: string) => Oracle {
	const cache = new Map<string, Oracle>();
	const facts = Object.fromEntries(
		Object.entries(kb.facts).map(([name, def]) => {
			const { role: _role, ...rest } = def;
			return [name, rest];
		}),
	);
	return (fact) => {
		const cached = cache.get(fact);
		if (cached !== undefined) return cached;
		let out: Oracle;
		try {
			const ref = referenceVerdict({ ...kb, goals: [fact], facts }, answers);
			out = { errors: false, value: ref.goals[fact] };
		} catch {
			out = { errors: true, value: undefined };
		}
		cache.set(fact, out);
		return out;
	};
}

function expectBare(node: ProofNode): void {
	expect(node.value).toBeUndefined();
	expect(node.children).toEqual([]);
	expect(node).not.toHaveProperty("rule");
	expect(node).not.toHaveProperty("clause");
	expect(node).not.toHaveProperty("because");
}

/** Checks one node (criteria 2 to 8, 11, 12) and recurses into its children. */
function checkNode(
	kb: KnowledgeBase,
	answers: Readonly<Record<string, FactValue>>,
	oracle: (fact: string) => Oracle,
	node: ProofNode,
	seen: Map<string, ProofNode>,
): void {
	// Criterion 9.12: every occurrence of a fact is a Deep_Equal subtree.
	const earlier = seen.get(node.fact);
	if (earlier !== undefined) {
		expect(node).toEqual(earlier);
		return;
	}
	seen.set(node.fact, node);

	const def = kb.facts[node.fact];
	expect(def).toBeDefined();
	const ref = oracle(node.fact);

	if (def?.derived !== true) {
		// Leaf (criterion 5).
		expect(node.source).toBe("answered");
		expect(node.children).toEqual([]);
		expect(node.value).toEqual(
			Object.hasOwn(answers, node.fact) ? answers[node.fact] : undefined,
		);
		expect(node).not.toHaveProperty("rule");
		expect(node).not.toHaveProperty("clause");
		expect(node).not.toHaveProperty("because");
		return;
	}

	expect(node.source).toBe("derived");

	// Criteria 11 and 9.14: a resolution that raises an error gives a bare node.
	if (ref.errors) {
		expectBare(node);
		return;
	}

	// Criteria 12 and 9.16: otherwise the node holds its Resolved_Value.
	expect(node.value).toEqual(ref.value);

	if (node.rule === undefined) {
		// Criterion 8.
		expect(node.value).toBeUndefined();
		expect(node).not.toHaveProperty("clause");
		expect(node).not.toHaveProperty("because");
	} else {
		const index = kb.rules.findIndex((r) => r.id === node.rule);
		expect(index).toBeGreaterThanOrEqual(0);
		const rule = kb.rules[index] as Rule;
		expect(rule.set).toBe(node.fact);

		// Criterion 6.
		expect(node.clause).toBe(rule.cite);
		expect(Object.hasOwn(kb.clauses, rule.cite)).toBe(true);

		// Criterion 7.
		const placeholders = [...(node.because ?? "").matchAll(/\{([^{}]*)\}/g)];
		for (const m of placeholders) {
			expect(Object.hasOwn(kb.facts, m[1] as string)).toBe(false);
		}

		// Environment from the children's values (undefined reads as Unknown).
		const env: Record<string, FactValue | typeof UNKNOWN> = {};
		for (const child of node.children) {
			env[child.fact] = child.value === undefined ? UNKNOWN : child.value;
		}
		const run = (expr: Expr) => {
			const names = new Set<string>();
			refsOf(expr, names);
			for (const n of names) expect(Object.hasOwn(env, n)).toBe(true);
			return evaluate(expr, env);
		};

		// Criterion 2.
		const result = run(rule.to);
		expect(result.ok).toBe(true);
		if (result.ok) expect(publicOf(result.value)).toEqual(node.value);

		// Criterion 3.
		if (rule.when !== undefined) {
			const guard = run(rule.when);
			expect(guard.ok && guard.value).toBe(true);
		}

		// Criterion 4.
		kb.rules.slice(0, index).forEach((before) => {
			if (before.set !== node.fact) return;
			expect(before.when).toBeDefined();
			const guard = run(before.when as Expr);
			expect(guard.ok && guard.value).toBe(false);
		});
	}

	for (const child of node.children)
		checkNode(kb, answers, oracle, child, seen);
}

/** Everything Property 3 asserts for one Session. */
function checkSession(session: Session): void {
	const { kb, answers } = session;
	const targets = [
		...new Set([
			...kb.goals,
			...Object.keys(kb.facts).filter((n) => {
				const role = kb.facts[n]?.role;
				return role === "deduction" || role === "check";
			}),
		]),
	];

	let nextOut: ReturnType<typeof next> | undefined;
	const nextCode = errorCodeOf(() => {
		nextOut = next(session);
	});

	if (nextCode !== undefined) {
		// Criterion 9.15: explain throws only where next throws, with the same code.
		for (const fact of targets) {
			const code = errorCodeOf(() => explain(session, fact));
			if (code !== undefined) expect(code).toBe(nextCode);
		}
		return;
	}

	// next did not throw: explain must return a tree for every target (16.13).
	const out = nextOut as unknown as ReturnType<typeof next>;
	const verdict: Verdict | undefined =
		out.kind === "verdict" ? out : errorOrUndefined(() => audit(kb, answers));
	const reference =
		verdict === undefined ? undefined : refVerdictOrUndef(session);
	const oracle = oracleFor(kb, answers);

	for (const fact of targets) {
		const tree = explain(session, fact);
		expect(tree.fact).toBe(fact);
		expect(walkPublic(tree, "explain")).toBeUndefined();
		expect(depthOf(tree)).toBeLessThanOrEqual(Object.keys(kb.facts).length);
		expect(countNodes(tree)).toBeGreaterThan(0);

		// Criterion 1: root value equals the Verdict's value and the reference.
		if (verdict !== undefined) {
			const item = verdict.lineItems.find((l) => l.fact === fact);
			const reported = kb.goals.includes(fact)
				? verdict.goals[fact]
				: item?.value;
			expect(tree.value).toEqual(reported);
			if (reference !== undefined) {
				const refValue = kb.goals.includes(fact)
					? reference.goals[fact]
					: reference.lineItems.find((l) => l.fact === fact)?.value;
				expect(tree.value).toEqual(refValue);
			}
		}

		checkNode(kb, answers, oracle, tree, new Map());
	}
}

function errorOrUndefined<T>(fn: () => T): T | undefined {
	try {
		return fn();
	} catch (error) {
		if (error instanceof EngineError) return undefined;
		throw error;
	}
}

function refVerdictOrUndef(session: Session) {
	return referenceVerdict(session.kb, session.answers);
}

// ─── Knowledge bases with an untaken branch that raises EVALUATION_ERROR ─────

function expr(src: string): Expr {
	const r = parse(src);
	if (!r.ok) throw new Error(`parse failed: ${r.error.message}`);
	return r.expr;
}

function rule(id: string, set: string, to: string): Rule {
	return {
		id,
		cite: `c-${id}`,
		set,
		to: expr(to),
		because: `${id}: a is {a}, b is {b}, z is {z}, ratio is {ratio}, {nope}`,
	};
}

interface ErrorCase {
	readonly session: Session;
	/** True when the division `b / a` sits in the untaken branch. */
	readonly skipped: boolean;
	readonly z: number | undefined;
}

// b = N / z raises DIVISION_BY_ZERO when z is 0.
// gt: ratio = if(a > t, b / a, F)
// le: ratio = if(a <= t, F, b / a)
// Both skip `b / a` (and so b) when a <= t.
const errorCaseArb: fc.Arbitrary<ErrorCase> = fc
	.record({
		shape: fc.constantFrom("gt", "le"),
		t: fc.integer({ min: -2, max: 5 }),
		fallback: fc.integer({ min: 0, max: 9 }),
		numerator: fc.integer({ min: 1, max: 20 }),
		a: fc.option(fc.integer({ min: -3, max: 8 }), { nil: undefined }),
		z: fc.option(fc.constantFrom(0, 0, 0, 1, 2), { nil: undefined }),
	})
	.map(({ shape, t, fallback, numerator, a, z }) => {
		const ratio =
			shape === "gt"
				? `if(a > ${t}, b / a, ${fallback})`
				: `if(a <= ${t}, ${fallback}, b / a)`;
		const kb: KnowledgeBase = {
			id: "untaken-error",
			goals: ["out", "ratio"],
			facts: {
				a: { type: "number", ask: "a?" },
				z: { type: "number", ask: "z?" },
				b: { type: "number", derived: true },
				ratio: { type: "number", derived: true },
				out: { type: "number", derived: true },
			},
			rules: [
				rule("r-b", "b", `${numerator} / z`),
				rule("r-ratio", "ratio", ratio),
				rule("r-out", "out", "ratio + 1"),
			],
			clauses: {
				"c-r-b": { id: "c-r-b", title: "B", text: "b" },
				"c-r-ratio": { id: "c-r-ratio", title: "Ratio", text: "ratio" },
				"c-r-out": { id: "c-r-out", title: "Out", text: "out" },
			},
		};
		const answers: Record<string, FactValue> = {};
		if (a !== undefined) answers.a = a;
		if (z !== undefined) answers.z = z;
		// Both shapes evaluate `b / a` only when a > t.
		const skipped = a !== undefined && a <= t;
		return { session: { kb, answers }, skipped, z };
	});

describe("Property 3: Sound proofs", () => {
	/**
	 * Criteria 1 to 8 and 11 to 12 on general generated knowledge bases, with
	 * Unknown and known values reaching the check.
	 * **Validates: Requirements 9.1, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8, 9.9, 9.10, 9.11, 9.12, 9.15, 16.1, 16.2, 16.3, 16.4, 16.5, 16.6, 16.7, 16.8, 16.10**
	 */
	it(
		"every proof tree is checkable (general knowledge bases)",
		() => {
			fc.assert(
				fc.property(generalSessionArb, (session) => {
					checkSession(session);
				}),
				PARAMS,
			);
		},
		TEST_TIMEOUT_MS,
	);

	/**
	 * Criteria 11 to 13 on knowledge bases with an untaken branch that raises
	 * EVALUATION_ERROR: explain returns a tree whenever next returns a Verdict,
	 * and the skipped failing child is a bare node.
	 * **Validates: Requirements 9.13, 9.14, 9.15, 9.16, 13.9, 16.9, 16.11, 16.12, 16.13**
	 */
	it(
		"explain returns a tree whenever next returns a Verdict (untaken error branch)",
		() => {
			fc.assert(
				fc.property(errorCaseArb, ({ session, skipped, z }) => {
					checkSession(session);

					if (skipped && z === 0) {
						// Branch untaken and failing: next must succeed and explain must too.
						const out = next(session);
						expect(out.kind).toBe("verdict");
						const tree = explain(session, "ratio");
						const b = tree.children.find((c) => c.fact === "b");
						expect(b).toBeDefined();
						expectBare(b as ProofNode);
						expect(b?.source).toBe("derived");
						// The parent's value never reads the skipped child.
						expect(tree.rule).toBe("r-ratio");
						expect(typeof tree.value).toBe("number");
						expect(typeof explain(session, "out").value).toBe("number");
					}
				}),
				PARAMS,
			);
		},
		TEST_TIMEOUT_MS,
	);
});
