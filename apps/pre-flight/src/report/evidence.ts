import type { ProofNode } from "@dead-certain/engine";

/** The evidence lines of the proof's collected facts, in tree order, without repeats (5.8). */
export function evidenceFor(
	proof: ProofNode,
	evidence: Readonly<Record<string, string>>,
): string {
	const lines: string[] = [];
	const walk = (n: ProofNode) => {
		const line =
			n.source === "collected" && Object.hasOwn(evidence, n.fact)
				? evidence[n.fact]
				: undefined;
		if (line !== undefined && !lines.includes(line)) lines.push(line);
		n.children.forEach(walk);
	};
	walk(proof);
	return lines.join("\n");
}
