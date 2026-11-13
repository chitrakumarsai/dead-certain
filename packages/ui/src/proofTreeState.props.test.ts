import type { ProofNode } from "@dead-certain/engine/types";
import fc from "fast-check";
import { expect, test } from "vitest";
import {
	initialTreeState,
	type Key,
	nodeAt,
	type TreeState,
	treeReduce,
	visibleIds,
} from "./components/proofTreeState";
import { deepProofFixture, hugeProofFixture } from "./fixtures";
import { proofArb } from "./testkit/proofArb";

const RUNS = { numRuns: 300 };
const KEYS: Key[] = [
	"ArrowDown",
	"ArrowUp",
	"ArrowRight",
	"ArrowLeft",
	"Home",
	"End",
	"Enter",
];
const keysArb = fc.array(fc.constantFrom(...KEYS), { maxLength: 40 });
const treeArb = fc.oneof(
	proofArb,
	fc.constantFrom(deepProofFixture, hugeProofFixture),
);

function allIds(root: ProofNode): string[] {
	const out: string[] = [];
	const walk = (node: ProofNode, id: string): void => {
		out.push(id);
		node.children.forEach((child, i) => {
			walk(child, `${id}.${i}`);
		});
	};
	walk(root, "0");
	return out;
}

function deepFreeze(state: TreeState): TreeState {
	// A Set cannot be frozen, so its mutators are made to throw.
	const expanded = new Set(state.expanded);
	const refuse = (): never => {
		throw new Error("the reducer mutated its input");
	};
	Object.assign(expanded, { add: refuse, delete: refuse, clear: refuse });
	return Object.freeze({ active: state.active, expanded });
}

test("tree reducer stays on screen", () => {
	// Feature: ui-kit, Property 5: Tree reducer stays on screen
	fc.assert(
		fc.property(treeArb, keysArb, (root, keys) => {
			let state = initialTreeState(root);

			for (const key of keys) {
				state = treeReduce(root, state, key);

				expect(visibleIds(root, state.expanded)).toContain(state.active);
				for (const id of state.expanded) {
					expect(nodeAt(root, id)?.children.length ?? 0).toBeGreaterThan(0);
				}
			}
		}),
		RUNS,
	);
});

test("tree reducer is pure", () => {
	// Feature: ui-kit, Property 6: Tree reducer is pure
	fc.assert(
		fc.property(
			treeArb,
			keysArb,
			fc.constantFrom(...KEYS),
			(root, keys, last) => {
				const reached = keys.reduce(
					(state, key) => treeReduce(root, state, key),
					initialTreeState(root),
				);
				const frozen = deepFreeze(reached);
				const before = {
					active: frozen.active,
					expanded: [...frozen.expanded],
				};

				const first = treeReduce(root, frozen, last);
				const second = treeReduce(root, frozen, last);

				expect({
					active: frozen.active,
					expanded: [...frozen.expanded],
				}).toEqual(before);
				expect(second).toEqual(first);
			},
		),
		RUNS,
	);
});

test("tree ids are unique", () => {
	// Feature: ui-kit, Property 7: Tree ids are unique
	fc.assert(
		fc.property(treeArb, (root) => {
			const everything = new Set(allIds(root));

			const visible = visibleIds(root, everything);

			expect(new Set(visible).size).toBe(visible.length);
			expect(visible).toHaveLength(allIds(root).length);
			for (const id of visible) expect(nodeAt(root, id)).toBeDefined();
		}),
		RUNS,
	);
});
