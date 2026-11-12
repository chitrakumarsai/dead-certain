import type { Expr, KnowledgeBase } from "./types";

/**
 * Distinct fact names referenced by an expression, in first-reference order,
 * walking left to right: binary left then right, call arguments in order,
 * unary operand. Iterative, so a deep expression cannot overflow the stack.
 */
export function factRefs(expr: Expr): string[] {
	const seen = new Set<string>();
	const out: string[] = [];
	const stack: Expr[] = [expr];
	while (stack.length > 0) {
		const node = stack.pop() as Expr;
		switch (node.kind) {
			case "literal":
				break;
			case "fact":
				if (!seen.has(node.name)) {
					seen.add(node.name);
					out.push(node.name);
				}
				break;
			case "unary":
				stack.push(node.operand);
				break;
			case "binary":
				// Pushed in reverse so the left operand is popped first.
				stack.push(node.right, node.left);
				break;
			case "call":
				for (let i = node.args.length - 1; i >= 0; i--) {
					stack.push(node.args[i] as Expr);
				}
				break;
		}
	}
	return out;
}

/**
 * Finds a dependency cycle. Edges run from `rule.set` to every fact in
 * `factRefs(rule.when)` and `factRefs(rule.to)`. The search starts from each
 * fact in `Object.keys(kb.facts)` order with white, grey and black marks.
 * Returns the facts on the first cycle found, starting at the first repeated
 * fact, or `undefined` when the graph is acyclic. Self-edges are cycles.
 */
export function findCycle(kb: KnowledgeBase): string[] | undefined {
	const edges = new Map<string, string[]>();
	for (const rule of kb.rules) {
		let list = edges.get(rule.set);
		if (list === undefined) {
			list = [];
			edges.set(rule.set, list);
		}
		const refs = [
			...(rule.when === undefined ? [] : factRefs(rule.when)),
			...factRefs(rule.to),
		];
		for (const ref of refs) {
			if (!list.includes(ref)) list.push(ref);
		}
	}

	// 1 = grey (on the current path), 2 = black (finished). Absent = white.
	const mark = new Map<string, 1 | 2>();

	for (const start of Object.keys(kb.facts)) {
		if (mark.has(start)) continue;
		const path: string[] = [start];
		const cursor: number[] = [0];
		mark.set(start, 1);
		while (path.length > 0) {
			const top = path[path.length - 1] as string;
			const out = edges.get(top) ?? [];
			const i = cursor[cursor.length - 1] as number;
			if (i >= out.length) {
				mark.set(top, 2);
				path.pop();
				cursor.pop();
				continue;
			}
			cursor[cursor.length - 1] = i + 1;
			const next = out[i] as string;
			const state = mark.get(next);
			if (state === 1) return path.slice(path.indexOf(next));
			if (state === undefined) {
				mark.set(next, 1);
				path.push(next);
				cursor.push(0);
			}
		}
	}
	return undefined;
}
