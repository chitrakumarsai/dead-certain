import { EngineError } from "./errors";
import { factRefs } from "./graph";
import { evaluateSession } from "./outcome";
import type { Resolution } from "./resolve";
import type { FactSource, FactValue, ProofNode, Rule, Session } from "./types";
import { hasOwn } from "./util";

/** The Resolved_Value as a public value: `undefined` unless known (and `-0` stored as `0`). */
function publicValue(res: Resolution): FactValue | undefined {
	if (res.status !== "known") return undefined;
	const v = res.value as FactValue;
	return v === 0 ? 0 : v;
}

/** Ordered, de-duplicated fact names referenced by the tried guards and the deciding `to`. */
function childNames(
	tried: readonly Rule[],
	deciding: Rule | undefined,
): string[] {
	const seen = new Set<string>();
	const out: string[] = [];
	const add = (names: readonly string[]): void => {
		for (const n of names) {
			if (!seen.has(n)) {
				seen.add(n);
				out.push(n);
			}
		}
	};
	for (const rule of tried) {
		if (rule.when !== undefined) add(factRefs(rule.when));
	}
	if (deciding !== undefined) add(factRefs(deciding.to));
	return out;
}

/**
 * Builds the Proof_Tree of one fact. Throws exactly the Engine_Error codes
 * `next` throws for the same Session, and no others: a fact referenced only
 * in a Skipped_Branch whose resolution fails becomes a bare node.
 */
export function explainFact(s: Session, fact: string): ProofNode {
	const kb = s.kb;
	// Same deciding evaluations as `next`, so the same errors surface first.
	const { resolver } = evaluateSession(kb, s.answers);
	const memo = new Map<string, ProofNode>();

	const sourceOf = (name: string): FactSource =>
		hasOwn(kb.facts, name) && kb.facts[name]?.derived === true
			? "derived"
			: "answered";

	const fillBecause = (text: string): string =>
		text.replace(/\{([^{}]*)\}/g, (whole, name: string) => {
			if (!hasOwn(kb.facts, name)) return whole;
			try {
				const res = resolver.fact(name);
				return res.status === "known" ? String(publicValue(res)) : "unknown";
			} catch (e) {
				if (e instanceof EngineError) return "unknown";
				throw e;
			}
		});

	const node = (name: string): ProofNode => {
		const cached = memo.get(name);
		if (cached !== undefined) return cached;
		const res = resolver.fact(name);
		const value = publicValue(res);
		let built: ProofNode;
		if (sourceOf(name) === "answered") {
			built = { fact: name, value, source: "answered", children: [] };
		} else {
			const names = childNames(res.tried, res.deciding);
			// Snapshot before resolving any child, so resolving one skipped
			// child cannot turn a later sibling into an evaluated one.
			const read = names.map((n) => resolver.wasRead(n));
			const children = names.map((n, i) =>
				read[i] === true ? node(n) : skippedNode(n, node, sourceOf),
			);
			built =
				res.deciding === undefined
					? { fact: name, value, source: "derived", children }
					: {
							fact: name,
							value,
							source: "derived",
							rule: res.deciding.id,
							clause: res.deciding.cite,
							because: fillBecause(res.deciding.because),
							children,
						};
		}
		memo.set(name, built);
		return built;
	};

	return node(fact);
}

/** A child referenced only in a Skipped_Branch: full when it resolves, bare on an Engine_Error. */
function skippedNode(
	name: string,
	node: (name: string) => ProofNode,
	sourceOf: (name: string) => FactSource,
): ProofNode {
	try {
		return node(name);
	} catch (e) {
		if (e instanceof EngineError) {
			return {
				fact: name,
				value: undefined,
				source: sourceOf(name),
				children: [],
			};
		}
		throw e;
	}
}
