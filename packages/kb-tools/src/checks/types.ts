import { type Expr, print } from "@dead-certain/engine";
import {
	clip,
	type LocatedDiagnostic,
	makeError,
	SECTION,
} from "../diagnostics";
import { children } from "../expr-walk";
import type { ParsedKb, ParsedRule } from "../model";

/** Static type of an expression. `money` is read as `number`. */
export type Ty = "boolean" | "number" | "date" | "enum" | "unknown";

type Known = Exclude<Ty, "unknown">;

/** Reports a TYPE_MISMATCH for `node` with a short reason. */
type Report = (node: Expr, reason: string) => void;

/** `money` counts as `number`; every other fact type is its own type. */
function readType(type: string): Known {
	return type === "money" ? "number" : (type as Known);
}

/**
 * Result type of one node given its children's types, or a mismatch reason.
 * Called only when no child type is `unknown`.
 */
function checkNode(
	node: Expr,
	kids: readonly Known[],
): { ty: Known } | { mismatch: string } {
	const [a, b, c] = kids;
	switch (node.kind) {
		case "literal":
			return { ty: readType(node.type) };
		case "fact":
			// Resolved by the caller, which knows the fact definitions.
			return { mismatch: "internal: fact reached checkNode" };
		case "unary":
			if (node.op === "not") {
				return a === "boolean"
					? { ty: "boolean" }
					: { mismatch: `'not' needs a boolean, found ${a}` };
			}
			return a === "number"
				? { ty: "number" }
				: { mismatch: `unary '-' needs a number, found ${a}` };
		case "binary": {
			const op = node.op;
			if (op === "+" || op === "-" || op === "*" || op === "/") {
				return a === "number" && b === "number"
					? { ty: "number" }
					: { mismatch: `'${op}' needs two numbers, found ${a} and ${b}` };
			}
			if (op === "==" || op === "!=") {
				return a === b
					? { ty: "boolean" }
					: { mismatch: `'${op}' compares ${a} with ${b}` };
			}
			if (op === "and" || op === "or") {
				return a === "boolean" && b === "boolean"
					? { ty: "boolean" }
					: { mismatch: `'${op}' needs two booleans, found ${a} and ${b}` };
			}
			// < <= > >=
			return a === b && (a === "number" || a === "date")
				? { ty: "boolean" }
				: {
						mismatch: `'${op}' needs two numbers or two dates, found ${a} and ${b}`,
					};
		}
		case "call":
			switch (node.fn) {
				case "min":
				case "max":
					return a === "number" && b === "number"
						? { ty: "number" }
						: {
								mismatch: `'${node.fn}' needs two numbers, found ${a} and ${b}`,
							};
				case "round":
					return a === "number"
						? { ty: "number" }
						: { mismatch: `'round' needs a number, found ${a}` };
				case "days_between":
					return a === "date" && b === "date"
						? { ty: "number" }
						: {
								mismatch: `'days_between' needs two dates, found ${a} and ${b}`,
							};
				default:
					// if(c, t, e)
					if (a !== "boolean") {
						return {
							mismatch: `the condition of 'if' needs a boolean, found ${a}`,
						};
					}
					return b === c && b !== undefined
						? { ty: b }
						: { mismatch: `the branches of 'if' differ: ${b} and ${c}` };
			}
	}
}

/**
 * Post-order walk (iterative, so deep chains cannot overflow the stack).
 * An `unknown` operand makes the node `unknown` and reports nothing; a node
 * that reports its own mismatch is `unknown` too, so one mistake stays one
 * message.
 */
export function inferType(
	expr: Expr,
	factType: (name: string) => Ty,
	report: Report,
): Ty {
	const results: Ty[] = [];
	const stack: { node: Expr; kids: readonly Expr[]; next: number }[] = [
		{ node: expr, kids: children(expr), next: 0 },
	];
	while (stack.length > 0) {
		const frame = stack[stack.length - 1] as (typeof stack)[number];
		if (frame.next < frame.kids.length) {
			const kid = frame.kids[frame.next] as Expr;
			frame.next += 1;
			stack.push({ node: kid, kids: children(kid), next: 0 });
			continue;
		}
		stack.pop();
		const node = frame.node;
		const kidTypes = results.splice(results.length - frame.kids.length);
		if (node.kind === "fact") {
			results.push(factType(node.name));
		} else if (kidTypes.includes("unknown")) {
			results.push("unknown");
		} else {
			const out = checkNode(node, kidTypes as Known[]);
			if ("ty" in out) {
				results.push(out.ty);
			} else {
				report(node, out.mismatch);
				results.push("unknown");
			}
		}
	}
	return results[0] ?? "unknown";
}

/** Static type checks for every rule's `to` and `when` (Requirements 10, 11). */
export function checkTypes(kb: ParsedKb, file: string): LocatedDiagnostic[] {
	const out: LocatedDiagnostic[] = [];
	const factType = (name: string): Ty => {
		const fact = kb.facts.get(name);
		return fact === undefined ? "unknown" : readType(fact.def.type);
	};

	for (const rule of kb.rules) {
		const at = { section: SECTION.rules, index: rule.index };
		try {
			checkRule(rule, "to", rule.toExpr);
			checkRule(rule, "when", rule.whenExpr);
		} catch (error) {
			if (!(error instanceof RangeError)) throw error;
			out.push(
				makeError(
					"PARSE_ERROR",
					file,
					`Rule '${clip(rule.id)}' is too deeply nested to type-check.`,
					{ id: rule.id, at },
				),
			);
		}
	}
	return out;

	function checkRule(
		rule: ParsedRule,
		field: "to" | "when",
		expr: Expr | undefined,
	): void {
		if (expr === undefined) return;
		const at = { section: SECTION.rules, index: rule.index };
		const ty = inferType(expr, factType, (node, reason) => {
			out.push(
				makeError(
					"TYPE_MISMATCH",
					file,
					`Rule '${clip(rule.id)}' field '${field}': ${reason} in '${clip(print(node))}'.`,
					{ id: rule.id, field, at },
				),
			);
		});
		if (ty === "unknown") return;

		if (field === "when") {
			if (ty !== "boolean") {
				out.push(
					makeError(
						"NOT_BOOLEAN",
						file,
						`Rule '${clip(rule.id)}' field 'when' must be boolean but has type ${ty}.`,
						{ id: rule.id, field, at },
					),
				);
			}
			return;
		}

		const expected = factType(rule.set);
		if (expected === "unknown" || expected === ty) return;
		out.push(
			makeError(
				"TYPE_MISMATCH",
				file,
				`Rule '${clip(rule.id)}' sets fact '${clip(rule.set)}' which expects ${expected}, but 'to' has type ${ty}.`,
				{ id: rule.id, field, at },
			),
		);
	}
}
