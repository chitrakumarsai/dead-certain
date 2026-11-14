import type { Expr } from "@dead-certain/engine";

/** Direct sub-expressions of a node, left to right. */
export function children(expr: Expr): readonly Expr[] {
	switch (expr.kind) {
		case "unary":
			return [expr.operand];
		case "binary":
			return [expr.left, expr.right];
		case "call":
			return expr.args;
		default:
			return [];
	}
}

/** Distinct fact names an expression reads, in left-to-right order. Iterative. */
export function factRefs(expr: Expr): string[] {
	const seen = new Set<string>();
	const out: string[] = [];
	const stack: Expr[] = [expr];
	while (stack.length > 0) {
		const node = stack.pop() as Expr;
		if (node.kind === "fact") {
			if (!seen.has(node.name)) {
				seen.add(node.name);
				out.push(node.name);
			}
			continue;
		}
		const kids = children(node);
		for (let i = kids.length - 1; i >= 0; i -= 1) stack.push(kids[i] as Expr);
	}
	return out;
}

/** Structural equality of two parsed expressions. Iterative. */
export function exprEqual(a: Expr, b: Expr): boolean {
	const stack: [Expr, Expr][] = [[a, b]];
	while (stack.length > 0) {
		const [x, y] = stack.pop() as [Expr, Expr];
		if (x.kind !== y.kind) return false;
		switch (x.kind) {
			case "literal": {
				const l = y as typeof x;
				if (x.type !== l.type || !Object.is(x.value, l.value)) return false;
				break;
			}
			case "fact":
				if (x.name !== (y as typeof x).name) return false;
				break;
			case "unary":
				if (x.op !== (y as typeof x).op) return false;
				stack.push([x.operand, (y as typeof x).operand]);
				break;
			case "binary": {
				const o = y as typeof x;
				if (x.op !== o.op) return false;
				stack.push([x.left, o.left], [x.right, o.right]);
				break;
			}
			case "call": {
				const o = y as typeof x;
				if (x.fn !== o.fn || x.args.length !== o.args.length) return false;
				x.args.forEach((arg, i) => {
					stack.push([arg, o.args[i] as Expr]);
				});
				break;
			}
		}
	}
	return true;
}

/**
 * The leaves whose value can become the expression's value: a literal is
 * itself; `if(c, t, e)` is the leaves of `t` and `e`, never of `c`; anything
 * else is empty. Iterative.
 */
export function valueLeaves(expr: Expr): Expr[] {
	const out: Expr[] = [];
	const stack: Expr[] = [expr];
	while (stack.length > 0) {
		const node = stack.pop() as Expr;
		if (node.kind === "literal") {
			out.push(node);
		} else if (node.kind === "call" && node.fn === "if") {
			const t = node.args[1];
			const e = node.args[2];
			if (e !== undefined) stack.push(e);
			if (t !== undefined) stack.push(t);
		}
	}
	return out;
}
