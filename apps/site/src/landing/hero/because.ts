import {
	explain,
	type FactValue,
	type ProofNode,
	type Session,
} from "@dead-certain/engine";
import { formatValue } from "@dead-certain/ui";
import { formatFor } from "../kb";

// Copied from apps/claim-check/src (session/relevance.ts and xray/because.ts).

/** A fact's value as the interface prints it. */
export function printValue(s: Session, fact: string, value: FactValue): string {
	const def = s.kb.facts[fact];
	return def === undefined
		? String(value)
		: formatValue(def, value, formatFor(s.kb));
}

/** The value of `fact` in this proof, or from its own proof when the tree does not hold it. */
function valueIn(
	node: ProofNode,
	s: Session,
	fact: string,
): ProofNode["value"] {
	const stack = [node];
	for (let n = stack.pop(); n !== undefined; n = stack.pop()) {
		if (n.fact === fact) return n.value;
		stack.push(...n.children);
	}
	return explain(s, fact).value;
}

/**
 * The engine fills a rule's {fact} placeholders with raw values, so money reads
 * "16500000". Each sentence is filled again from the rule's template with the
 * value as the interface prints it: "₹1,65,000".
 */
export function withPrintedBecause(node: ProofNode, s: Session): ProofNode {
	const rule = s.kb.rules.find((r) => r.id === node.rule);
	const children = node.children.map((child) => withPrintedBecause(child, s));
	if (rule === undefined || node.because === undefined)
		return { ...node, children };
	const because = rule.because.replace(/\{(\w+)\}/g, (whole, fact: string) => {
		const value = valueIn(node, s, fact);
		return value === undefined ? whole : printValue(s, fact, value);
	});
	return { ...node, because, children };
}
