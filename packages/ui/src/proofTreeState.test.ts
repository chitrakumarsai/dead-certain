import { expect, test } from "vitest";
import {
	initialTreeState,
	nodeAt,
	parentId,
	type TreeState,
	treeReduce,
	visibleIds,
} from "./components/proofTreeState";
import { deepProofFixture, hugeProofFixture } from "./fixtures";

const root = deepProofFixture;
const state = (active: string, ...expanded: string[]): TreeState => ({
	active,
	expanded: new Set(expanded),
});

test("ids are index paths from the root", () => {
	expect(nodeAt(root, "0")).toBe(root);
	expect(nodeAt(root, "0.0")).toBe(root.children[0]);
	expect(nodeAt(root, "0.0.0.0")?.children).toEqual([]);
	expect(nodeAt(root, "0.9")).toBeUndefined();
	expect(parentId("0.1.0")).toBe("0.1");
	expect(parentId("0")).toBeUndefined();
});

test("the initial state opens the root and its direct children, on the root", () => {
	const initial = initialTreeState(root);

	expect(initial.active).toBe("0");
	expect([...initial.expanded].sort()).toEqual(["0", "0.0", "0.1"]);
	expect(visibleIds(root, initial.expanded)).toEqual([
		"0",
		"0.0",
		"0.0.0",
		"0.1",
		"0.1.0",
	]);
});

test("a leaf root starts with nothing expanded", () => {
	const leaf = nodeAt(root, "0.1.0");
	if (!leaf) throw new Error("fixture changed");

	expect(initialTreeState(leaf)).toEqual({ active: "0", expanded: new Set() });
});

test("Down stops at the last visible node and Up at the first", () => {
	const open = state("0.1", "0");

	expect(treeReduce(root, open, "ArrowDown").active).toBe("0.1");
	expect(treeReduce(root, state("0", "0"), "ArrowUp").active).toBe("0");
	expect(treeReduce(root, state("0", "0"), "ArrowDown").active).toBe("0.0");
	expect(treeReduce(root, open, "ArrowUp").active).toBe("0.0");
});

test("Home and End go to the first and last visible node", () => {
	const initial = initialTreeState(root);

	expect(treeReduce(root, { ...initial, active: "0.1" }, "Home").active).toBe(
		"0",
	);
	expect(treeReduce(root, initial, "End").active).toBe("0.1.0");
});

test("Right opens a closed parent, then moves to its first child", () => {
	const closed = state("0.0", "0");

	const opened = treeReduce(root, closed, "ArrowRight");
	const moved = treeReduce(root, opened, "ArrowRight");

	expect(opened).toEqual(state("0.0", "0", "0.0"));
	expect(moved.active).toBe("0.0.0");
});

test("Right and Enter on a leaf change nothing", () => {
	const onLeaf = state("0.1.0", "0", "0.1");

	expect(treeReduce(root, onLeaf, "ArrowRight")).toBe(onLeaf);
	expect(treeReduce(root, onLeaf, "Enter")).toBe(onLeaf);
});

test("Left closes an open parent, and otherwise moves to the parent", () => {
	const open = state("0.1", "0", "0.1");

	const closed = treeReduce(root, open, "ArrowLeft");
	const moved = treeReduce(root, closed, "ArrowLeft");

	expect(closed).toEqual(state("0.1", "0"));
	expect(moved.active).toBe("0");
});

test("Left on a closed root stays on the root", () => {
	expect(treeReduce(root, state("0"), "ArrowLeft")).toEqual(state("0"));
});

test("Enter toggles a parent", () => {
	const closed = state("0.0", "0");

	const opened = treeReduce(root, closed, "Enter");

	expect(opened.expanded.has("0.0")).toBe(true);
	expect(treeReduce(root, opened, "Enter").expanded.has("0.0")).toBe(false);
});

test("a stale active id falls back to the root and does not throw", () => {
	expect(treeReduce(root, state("0.7.7", "0"), "ArrowDown").active).toBe("0");
	expect(treeReduce(root, state("0.7.7", "0"), "Enter").active).toBe("0");
});

test("the deep fixture has four levels and one fact under two rules", () => {
	const all = new Set<string>();
	const facts: string[] = [];
	const walk = (id: string): void => {
		const node = nodeAt(root, id);
		if (!node) return;
		all.add(id);
		facts.push(node.fact);
		node.children.forEach((_, i) => {
			walk(`${id}.${i}`);
		});
	};
	walk("0");

	expect(Math.max(...[...all].map((id) => id.split(".").length))).toBe(4);
	expect(facts.filter((fact) => fact === "sum_insured")).toHaveLength(2);
});

test("the huge fixture has exactly 200 nodes", () => {
	const count = (node: typeof hugeProofFixture): number =>
		1 + node.children.reduce((sum, child) => sum + count(child), 0);

	expect(count(hugeProofFixture)).toBe(200);
});
