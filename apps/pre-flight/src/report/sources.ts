import type { ProofNode } from "@dead-certain/engine";

/**
 * The engine marks every non-derived fact "answered". A fact the collector
 * read is "collected" instead (7.4). Pure: returns a new tree.
 */
export function relabelSources(
	node: ProofNode,
	collected: ReadonlySet<string>,
): ProofNode {
	const source =
		node.source === "answered" && collected.has(node.fact)
			? "collected"
			: node.source;
	return {
		...node,
		source,
		children: node.children.map((c) => relabelSources(c, collected)),
	};
}
