import { explain, type ProofNode, type Session } from "@dead-certain/engine";
import { printValue } from "../session/relevance";

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
