import type { BinaryOp, Expr } from "../types";

const BINARY_PREC: Record<BinaryOp, number> = {
	or: 1,
	and: 2,
	"==": 3,
	"!=": 3,
	"<": 3,
	"<=": 3,
	">": 3,
	">=": 3,
	"+": 4,
	"-": 4,
	"*": 5,
	"/": 5,
};

/** Comparison operators are non-associative — neither left nor right nesting is valid. */
const COMPARISON_OPS = new Set<BinaryOp>(["==", "!=", "<", "<=", ">", ">="]);

const UNARY_PREC = 6;
const _ATOM_PREC = 7;

function printNode(expr: Expr, parentPrec: number): string {
	let result: string;

	switch (expr.kind) {
		case "literal": {
			if (expr.type === "date") {
				result = `"${expr.value}"`;
			} else if (expr.type === "enum") {
				result = `'${expr.value}'`;
			} else if (expr.type === "boolean") {
				result = String(expr.value);
			} else {
				// number or money — use JS default toString (no trailing zeros)
				result = (expr.value as number).toString();
			}
			// Atoms never need parens (ATOM_PREC = 7, always highest)
			return result;
		}

		case "fact": {
			// Atoms never need parens
			return expr.name;
		}

		case "unary": {
			const childStr = printNode(expr.operand, UNARY_PREC);
			if (expr.op === "not") {
				result = `not ${childStr}`;
			} else {
				// op === "-"
				result = `-${childStr}`;
			}
			if (UNARY_PREC < parentPrec) {
				return `(${result})`;
			}
			return result;
		}

		case "binary": {
			const level = BINARY_PREC[expr.op];
			let leftStr: string;
			let rightStr: string;
			if (COMPARISON_OPS.has(expr.op)) {
				// Comparison operators are non-associative. Neither left nor right child
				// may be at the same comparison level without parens, because chaining
				// comparisons is not valid syntax (parseCompare consumes exactly one
				// comparison operator). Pass level + 1 for both children so that any
				// comparison-level child is wrapped.
				leftStr = printNode(expr.left, level + 1);
				rightStr = printNode(expr.right, level + 1);
			} else {
				// Left-associative operator: left child at same level is fine, right child
				// at same level must be wrapped (would change associativity).
				// Pass parentPrec = level so the left child wraps when child.level < level.
				leftStr = printNode(expr.left, level);
				// Pass parentPrec = level + 1 so the right child wraps when child.level <= level.
				rightStr = printNode(expr.right, level + 1);
			}
			result = `${leftStr} ${expr.op} ${rightStr}`;
			if (level < parentPrec) {
				return `(${result})`;
			}
			return result;
		}

		case "call": {
			const argsStr = expr.args.map((arg) => printNode(arg, 0)).join(", ");
			result = `${expr.fn}(${argsStr})`;
			// Calls are atoms, never need parens
			return result;
		}

		default:
			throw new Error(
				`print: unrecognised Expr kind: ${(expr as { kind: string }).kind}`,
			);
	}
}

export function print(expr: Expr): string {
	return printNode(expr, 0);
}
