import { EngineError, type KnowledgeBase, start } from "@dead-certain/engine";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { factRefs } from "./expr-walk";
import { type Diagnostic, validateText } from "./index";
import { cyclicKbArb, kbArb, renderYaml } from "./testkit";

const FILE = "apps/demo/kb/demo.yaml";

function engineSaysCycle(kb: KnowledgeBase): boolean {
	try {
		start(kb);
		return false;
	} catch (error) {
		if (error instanceof EngineError && error.code === "CYCLE") return true;
		throw error;
	}
}

/** The dependency graph: edge from `rule.set` to every fact in `to` and `when`. */
function edgesOf(kb: KnowledgeBase): Map<string, Set<string>> {
	const edges = new Map<string, Set<string>>();
	for (const rule of kb.rules) {
		const out = edges.get(rule.set) ?? new Set<string>();
		for (const n of factRefs(rule.to)) out.add(n);
		if (rule.when !== undefined)
			for (const n of factRefs(rule.when)) out.add(n);
		edges.set(rule.set, out);
	}
	return edges;
}

function checkOf(kb: KnowledgeBase): {
	all: readonly Diagnostic[];
	cycles: Diagnostic[];
} {
	const all = validateText(renderYaml(kb), FILE).diagnostics;
	return { all, cycles: all.filter((d) => d.code === "CYCLE") };
}

/** Parses 'Dependency cycle: a -> b -> a.' into its facts, or a self-reference into [name]. */
function pathOf(message: string): string[] {
	const path = /^Dependency cycle: (.+)\.$/.exec(message);
	if (path?.[1] !== undefined) return path[1].split(" -> ");
	const self = /^Fact '(.+)' depends on itself:/.exec(message);
	if (self?.[1] !== undefined) return [self[1], self[1]];
	throw new Error(`unrecognised CYCLE message: ${message}`);
}

describe("Property 7: Cycle reports agree with the engine and are canonical", () => {
	// Feature: kb-tools, Property 7: Cycle reports agree with the engine and are canonical
	// **Validates: Requirements 8.2, 8.3, 8.6**
	it("reports CYCLE exactly when the engine's start throws CYCLE", () => {
		fc.assert(
			fc.property(fc.oneof(kbArb, cyclicKbArb), (kb) => {
				const { all, cycles } = checkOf(kb);
				// No other error: only the cycle code may be an error here.
				expect(
					all.filter((d) => d.severity === "error" && d.code !== "CYCLE"),
				).toEqual([]);
				expect(cycles.length > 0).toBe(engineSaysCycle(kb));
			}),
			{ numRuns: 200 },
		);
	});

	it("reports at least one CYCLE for every cyclic knowledge base", () => {
		fc.assert(
			fc.property(cyclicKbArb, (kb) => {
				expect(engineSaysCycle(kb)).toBe(true);
				expect(checkOf(kb).cycles.length).toBeGreaterThan(0);
			}),
			{ numRuns: 200 },
		);
	});

	it("starts each path at the alphabetically first fact and closes it along real edges", () => {
		fc.assert(
			fc.property(cyclicKbArb, (kb) => {
				const edges = edgesOf(kb);
				for (const diag of checkOf(kb).cycles) {
					const path = pathOf(diag.message);
					const first = path[0] as string;
					const last = path[path.length - 1] as string;
					expect(last).toBe(first);
					expect(diag.id).toBe(first);
					const members = new Set(path);
					// The component of `first`: facts that reach it and are reached from it.
					const reach = (from: string, graph: Map<string, Set<string>>) => {
						const seen = new Set<string>([from]);
						const todo = [from];
						while (todo.length > 0) {
							for (const n of graph.get(todo.pop() as string) ?? []) {
								if (!seen.has(n)) {
									seen.add(n);
									todo.push(n);
								}
							}
						}
						return seen;
					};
					const reverse = new Map<string, Set<string>>();
					for (const [from, tos] of edges)
						for (const to of tos) {
							const back = reverse.get(to) ?? new Set<string>();
							back.add(from);
							reverse.set(to, back);
						}
					const forward = reach(first, edges);
					const backward = reach(first, reverse);
					for (const n of forward) {
						if (backward.has(n)) expect(first <= n).toBe(true);
					}
					for (const n of members)
						expect(forward.has(n) && backward.has(n)).toBe(true);
					for (let i = 0; i + 1 < path.length; i += 1) {
						expect(
							edges.get(path[i] as string)?.has(path[i + 1] as string),
						).toBe(true);
					}
				}
			}),
			{ numRuns: 200 },
		);
	});

	it("includes self-references", () => {
		fc.assert(
			fc.property(
				// A one-fact cycle that is not tied to the base: a pure self-reference.
				cyclicKbArb.filter(
					(kb) =>
						"cycle_node_0" in kb.facts &&
						!("cycle_node_1" in kb.facts) &&
						!kb.rules.some((r) => r.id.startsWith("X-back")),
				),
				(kb) => {
					const found = checkOf(kb).cycles.filter(
						(d) => d.id === "cycle_node_0",
					);
					expect(found).toHaveLength(1);
					expect(found[0]?.message).toMatch(
						/^Fact 'cycle_node_0' depends on itself: rule 'X-0' /,
					);
				},
			),
			{ numRuns: 200 },
		);
	});
});
