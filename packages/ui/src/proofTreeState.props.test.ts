import type { ProofNode } from "@dead-certain/engine/types";
import fc from "fast-check";
import { expect, test } from "vitest";
import {
	initialTreeState,
	type Key,
	nodeAt,
	normalizeTreeState,
	parentId,
	type TreeState,
	toggleNode,
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

/** Any state at all for a tree: real ids, leaves, junk ids, hidden focus. */
const rawStateArb = (root: ProofNode): fc.Arbitrary<TreeState> => {
	const ids = allIds(root);
	const idArb = fc.oneof(fc.constantFrom(...ids), fc.string({ maxLength: 6 }));
	return fc.record({
		active: idArb,
		expanded: fc.array(idArb, { maxLength: 12 }).map((list) => new Set(list)),
	});
};
const treeAndStateArb = treeArb.chain((root) =>
	fc.tuple(fc.constant(root), rawStateArb(root)),
);

/** Valid: active is visible, only real parents are open, and every ancestor of an open node is open. */
function expectValid(root: ProofNode, state: TreeState): void {
	expect(visibleIds(root, state.expanded)).toContain(state.active);
	for (const id of state.expanded) {
		expect(nodeAt(root, id)?.children.length ?? 0).toBeGreaterThan(0);
		const parent = parentId(id);
		if (parent !== undefined) expect(state.expanded.has(parent)).toBe(true);
	}
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

test("normalising any state gives a valid one, and is idempotent", () => {
	fc.assert(
		fc.property(treeAndStateArb, ([root, raw]) => {
			const state = normalizeTreeState(root, raw);

			expectValid(root, state);
			const again = normalizeTreeState(root, state);
			expect(again.active).toBe(state.active);
			expect([...again.expanded].sort()).toEqual([...state.expanded].sort());
		}),
		RUNS,
	);
});

test("from any starting state, keys and pointer toggles keep the tree valid", () => {
	// Feature: ui-kit, Property 5 from arbitrary states, not only the initial one.
	fc.assert(
		fc.property(
			treeAndStateArb,
			fc.array(
				fc.oneof(
					fc.constantFrom(...KEYS),
					fc.nat({ max: 400 }).map((n) => ({ toggle: n })),
				),
				{ maxLength: 40 },
			),
			([root, raw], steps) => {
				const ids = allIds(root);
				let state: TreeState = raw;
				for (const step of steps) {
					state =
						typeof step === "string"
							? treeReduce(root, state, step)
							: toggleNode(
									root,
									state,
									ids[step.toggle % ids.length] as string,
								);
					expectValid(root, state);
				}
			},
		),
		RUNS,
	);
});
