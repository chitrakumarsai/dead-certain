import type { ProofNode } from "@dead-certain/engine/types";

export type Key =
	| "ArrowDown"
	| "ArrowUp"
	| "ArrowRight"
	| "ArrowLeft"
	| "Home"
	| "End"
	| "Enter";

/** Node ids are index paths: "0" is the root, "0.1.0" its second child's first child. */
export interface TreeState {
	readonly active: string;
	readonly expanded: ReadonlySet<string>;
}

const ROOT_ID = "0";

export function withId(
	set: ReadonlySet<string>,
	id: string,
): ReadonlySet<string> {
	return new Set([...set, id]);
}

export function withoutId(
	set: ReadonlySet<string>,
	id: string,
): ReadonlySet<string> {
	return new Set([...set].filter((member) => member !== id));
}

export function toggled(
	set: ReadonlySet<string>,
	id: string,
): ReadonlySet<string> {
	return set.has(id) ? withoutId(set, id) : withId(set, id);
}

/** The node an index path names, or undefined when the path leaves the tree. */
export function nodeAt(root: ProofNode, id: string): ProofNode | undefined {
	const [first, ...rest] = id.split(".");
	if (first !== ROOT_ID) return undefined;
	let node: ProofNode | undefined = root;
	for (const step of rest) {
		node = /^\d+$/.test(step) ? node?.children[Number(step)] : undefined;
	}
	return node;
}

export function parentId(id: string): string | undefined {
	const cut = id.lastIndexOf(".");
	return cut < 0 ? undefined : id.slice(0, cut);
}

/** Ids of the rows on screen, top to bottom: a node, then its children if open. */
export function visibleIds(
	root: ProofNode,
	expanded: ReadonlySet<string>,
): string[] {
	const out: string[] = [];
	const walk = (node: ProofNode, id: string): void => {
		out.push(id);
		if (!expanded.has(id)) return;
		node.children.forEach((child, i) => {
			walk(child, `${id}.${i}`);
		});
	};
	walk(root, ROOT_ID);
	return out;
}

/** The root and its direct children start open. Deeper nodes start closed. */
export function initialTreeState(root: ProofNode): TreeState {
	const open = [
		...(root.children.length > 0 ? [ROOT_ID] : []),
		...root.children.flatMap((child, i) =>
			child.children.length > 0 ? [`${ROOT_ID}.${i}`] : [],
		),
	];
	return { active: ROOT_ID, expanded: new Set(open) };
}

function sameState(a: TreeState, b: TreeState): boolean {
	return (
		a.active === b.active &&
		a.expanded.size === b.expanded.size &&
		[...a.expanded].every((id) => b.expanded.has(id))
	);
}

/** Closes a branch: the node and everything open below it. */
function withoutBranch(
	set: ReadonlySet<string>,
	id: string,
): ReadonlySet<string> {
	return new Set(
		[...set].filter((member) => member !== id && !member.startsWith(`${id}.`)),
	);
}

/** Ids of the node's ancestors, nearest last: "0.1.2" gives ["0", "0.1"]. */
function ancestorIds(id: string): string[] {
	const parts = id.split(".");
	return parts.slice(1).map((_, i) => parts.slice(0, i + 1).join("."));
}

/**
 * Any state made valid for this tree, without trusting the caller: ids not in
 * the tree and leaves leave the open set; every ancestor of an open or active
 * node opens, so nothing sits inside a closed branch; a missing active id
 * falls back to the root.
 */
export function normalizeTreeState(root: ProofNode, s: TreeState): TreeState {
	const isParent = (id: string): boolean =>
		(nodeAt(root, id)?.children.length ?? 0) > 0;
	const active = nodeAt(root, s.active) ? s.active : ROOT_ID;
	const open = [...s.expanded].filter(isParent);
	const expanded = new Set(
		[...open, active].flatMap((id) => [
			...ancestorIds(id),
			...(open.includes(id) ? [id] : []),
		]),
	);
	return { active, expanded };
}

/**
 * The ARIA tree keyboard model as a pure function. The result's `active` is
 * always a visible row, a leaf never enters `expanded`, and `s` is not changed.
 */
export function treeReduce(
	root: ProofNode,
	input: TreeState,
	key: Key,
): TreeState {
	// A stale id (the tree changed under the state) goes back to the root, and
	// the key is not applied. A valid input is used as is, so a no-op returns it.
	if (!nodeAt(root, input.active)) return normalizeTreeState(root, input);
	const normal = normalizeTreeState(root, input);
	const s = sameState(normal, input) ? input : normal;
	const vis = visibleIds(root, s.expanded);
	const at = vis.indexOf(s.active);
	const node = nodeAt(root, s.active) as ProofNode;
	const last = vis.length - 1;
	const isParent = node.children.length > 0;
	const isOpen = s.expanded.has(s.active);

	switch (key) {
		case "ArrowDown":
			return { ...s, active: vis[Math.min(at + 1, last)] as string };
		case "ArrowUp":
			return { ...s, active: vis[Math.max(at - 1, 0)] as string };
		case "Home":
			return { ...s, active: ROOT_ID };
		case "End":
			return { ...s, active: vis[last] as string };
		case "ArrowRight":
			if (!isParent) return s;
			return isOpen
				? { ...s, active: `${s.active}.0` }
				: { ...s, expanded: withId(s.expanded, s.active) };
		case "ArrowLeft":
			return isOpen
				? { ...s, expanded: withoutBranch(s.expanded, s.active) }
				: { ...s, active: parentId(s.active) ?? s.active };
		case "Enter":
			if (!isParent) return s;
			return {
				...s,
				expanded: isOpen
					? withoutBranch(s.expanded, s.active)
					: withId(s.expanded, s.active),
			};
	}
}

/** A pointer toggle: the node becomes active and its branch opens or closes. */
export function toggleNode(
	root: ProofNode,
	input: TreeState,
	id: string,
): TreeState {
	const s = normalizeTreeState(root, { ...input, active: id });
	if ((nodeAt(root, s.active)?.children.length ?? 0) === 0) return s;
	return {
		...s,
		expanded: s.expanded.has(s.active)
			? withoutBranch(s.expanded, s.active)
			: withId(s.expanded, s.active),
	};
}
