import {
	clip,
	type LocatedDiagnostic,
	makeError,
	SECTION,
} from "../diagnostics";
import { factRefs } from "../expr-walk";
import type { ParsedKb, ParsedRule } from "../model";

function compareUnits(a: string, b: string): number {
	if (a < b) return -1;
	if (a > b) return 1;
	return 0;
}

/** Names a rule reads in `to` and `when`, or undefined if it is not reference-clean. */
function cleanRefs(kb: ParsedKb, rule: ParsedRule): string[] | undefined {
	if (!kb.facts.has(rule.set)) return undefined;
	if (rule.toExpr === undefined) return undefined;
	if (rule.whenText !== undefined && rule.whenExpr === undefined) {
		return undefined;
	}
	const refs = factRefs(rule.toExpr);
	if (rule.whenExpr !== undefined) refs.push(...factRefs(rule.whenExpr));
	for (const name of refs) if (!kb.facts.has(name)) return undefined;
	return refs;
}

/** Iterative Tarjan: strongly connected components of `edges`. */
function components(
	nodes: readonly string[],
	edges: ReadonlyMap<string, ReadonlySet<string>>,
): string[][] {
	const index = new Map<string, number>();
	const low = new Map<string, number>();
	const onStack = new Set<string>();
	const stack: string[] = [];
	const result: string[][] = [];
	let counter = 0;

	for (const root of nodes) {
		if (index.has(root)) continue;
		const work: { node: string; next: string[] }[] = [];
		const enter = (node: string): void => {
			index.set(node, counter);
			low.set(node, counter);
			counter += 1;
			stack.push(node);
			onStack.add(node);
			work.push({ node, next: [...(edges.get(node) ?? [])].reverse() });
		};
		enter(root);
		while (work.length > 0) {
			const frame = work[work.length - 1] as (typeof work)[number];
			const succ = frame.next.pop();
			if (succ !== undefined) {
				if (!index.has(succ)) {
					enter(succ);
				} else if (onStack.has(succ)) {
					low.set(
						frame.node,
						Math.min(low.get(frame.node) as number, index.get(succ) as number),
					);
				}
				continue;
			}
			work.pop();
			const parent = work[work.length - 1];
			if (parent !== undefined) {
				low.set(
					parent.node,
					Math.min(
						low.get(parent.node) as number,
						low.get(frame.node) as number,
					),
				);
			}
			if (low.get(frame.node) === index.get(frame.node)) {
				const comp: string[] = [];
				let member: string;
				do {
					member = stack.pop() as string;
					onStack.delete(member);
					comp.push(member);
				} while (member !== frame.node);
				result.push(comp);
			}
		}
	}
	return result;
}

/** Shortest path from `start` back to `start` inside `members`, neighbours in alphabetical order. */
function cyclePath(
	start: string,
	members: ReadonlySet<string>,
	edges: ReadonlyMap<string, ReadonlySet<string>>,
): string[] {
	const parent = new Map<string, string>();
	const queue: string[] = [start];
	for (let head = 0; head < queue.length; head += 1) {
		const node = queue[head] as string;
		const next = [...(edges.get(node) ?? [])]
			.filter((n) => members.has(n))
			.sort(compareUnits);
		for (const n of next) {
			if (n === start) {
				const path = [node];
				let cur = node;
				while (cur !== start) {
					cur = parent.get(cur) as string;
					path.push(cur);
				}
				return [...path.reverse(), start];
			}
			if (!parent.has(n)) {
				parent.set(n, node);
				queue.push(n);
			}
		}
	}
	return [start];
}

/**
 * CYCLE: one diagnostic per strongly connected component of the dependency
 * graph, built from reference-clean rules only (Requirement 8).
 */
export function checkCycles(kb: ParsedKb, file: string): LocatedDiagnostic[] {
	const edges = new Map<string, Set<string>>();
	const selfRule = new Map<string, string>();
	for (const name of kb.facts.keys()) edges.set(name, new Set());

	for (const rule of kb.rules) {
		const refs = cleanRefs(kb, rule);
		if (refs === undefined) continue;
		const out = edges.get(rule.set) as Set<string>;
		for (const name of refs) {
			out.add(name);
			if (name === rule.set && !selfRule.has(name)) {
				selfRule.set(name, rule.id);
			}
		}
	}

	const found: { first: number; diag: LocatedDiagnostic }[] = [];
	for (const comp of components([...kb.facts.keys()], edges)) {
		const only = comp[0] as string;
		const isSelf = comp.length === 1 && edges.get(only)?.has(only) === true;
		if (comp.length < 2 && !isSelf) continue;

		const sorted = [...comp].sort(compareUnits);
		const s = sorted[0] as string;
		const first = Math.min(
			...comp.map((n) => kb.facts.get(n)?.index ?? Number.MAX_SAFE_INTEGER),
		);
		const message = isSelf
			? `Fact '${clip(s)}' depends on itself: rule '${clip(selfRule.get(s) as string)}' sets it from an expression that reads it.`
			: `Dependency cycle: ${cyclePath(s, new Set(comp), edges)
					.map((n) => clip(n))
					.join(" -> ")}.`;
		found.push({
			first,
			diag: makeError("CYCLE", file, message, {
				id: s,
				at: { section: SECTION.facts, index: first },
			}),
		});
	}

	return found.sort((a, b) => a.first - b.first).map((f) => f.diag);
}
