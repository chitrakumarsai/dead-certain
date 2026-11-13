// Test-only generators. Never imported from non-test source, never exported from index.ts.
import {
	type Expr,
	type FactDef,
	type KnowledgeBase,
	parse,
	type Rule,
} from "@dead-certain/engine";
import fc from "fast-check";
import { kbArb } from "./kb";

function expr(source: string): Expr {
	const result = parse(source);
	if (!result.ok)
		throw new Error(`testkit expression '${source}' did not parse`);
	return result.expr;
}

/** A boolean expression that reads `name` whatever its type. */
function condOf(name: string, def: FactDef): string {
	switch (def.type) {
		case "boolean":
			return name;
		case "number":
		case "money":
			return `${name} >= 0`;
		default:
			return `${name} == ${name}`;
	}
}

/**
 * An acyclic base from `kbArb` plus a dependency cycle made of 1 to 3 fresh derived
 * facts. A cycle of one fact is a self-edge. Optionally one existing derived fact is
 * tied in with a back-edge (it reads the cycle in a new guarded rule, and the cycle
 * reads it). Every result makes the engine's `start` throw CYCLE.
 */
export const cyclicKbArb: fc.Arbitrary<KnowledgeBase> = fc
	.tuple(kbArb, fc.integer({ min: 1, max: 3 }), fc.boolean(), fc.nat())
	.map(([base, size, linkBase, pickIndex]) => {
		const clauseId = Object.keys(base.clauses)[0] ?? "1";
		const facts: Record<string, FactDef> = Object.fromEntries(
			Object.entries(base.facts),
		);
		const rules: Rule[] = [...base.rules];
		const nodes = Array.from({ length: size }, (_, i) => `cycle_node_${i}`);
		const node0 = nodes[0] ?? "cycle_node_0";
		const numberDef: FactDef = { type: "number", derived: true };
		for (const node of nodes) facts[node] = numberDef;
		nodes.forEach((node, i) => {
			const next = nodes[(i + 1) % size] ?? node0;
			rules.push({
				id: `X-${i}`,
				cite: clauseId,
				set: node,
				to: expr(`if(${condOf(next, numberDef)}, 1, 0)`),
				because: "Cycle edge.",
			});
		});
		const derived = Object.entries(base.facts).filter(
			([, def]) => def.derived === true,
		);
		if (linkBase && derived.length > 0) {
			const [name, def] = derived[pickIndex % derived.length] ?? [];
			if (name !== undefined && def !== undefined) {
				const original = base.rules.find((r) => r.set === name);
				rules.push({
					id: "X-back-1",
					cite: clauseId,
					set: name,
					when: expr(condOf(node0, numberDef)),
					to: original?.to ?? expr("1"),
					because: "Back-edge.",
				});
				rules.push({
					id: "X-back-2",
					cite: clauseId,
					set: node0,
					to: expr(`if(${condOf(name, def)}, 1, 0)`),
					because: "Back-edge.",
				});
			}
		}
		return { ...base, facts, rules };
	});
