import type {
	Clause,
	Expr,
	FactDef,
	KnowledgeBase,
	Rule,
} from "@dead-certain/engine";
import { analyse } from "./analyse";
import { type Diagnostic, finalizeDiagnostics, makeError } from "./diagnostics";
import type { ParsedKb, ParsedRule } from "./model";

export type CompileResult =
	| {
			readonly ok: true;
			readonly kb: KnowledgeBase;
			readonly json: string;
			readonly diagnostics: readonly Diagnostic[];
	  }
	| { readonly ok: false; readonly diagnostics: readonly Diagnostic[] };

/** Thrown internally when a non-finite number literal reaches the compiler. */
class NonFinite extends Error {}

/** Rebuild an Expr with keys in the fixed order of the key-order table. */
function orderExpr(e: Expr): Expr {
	switch (e.kind) {
		case "literal":
			if (e.type === "number" && !Number.isFinite(e.value)) {
				throw new NonFinite();
			}
			return { kind: "literal", type: e.type, value: e.value };
		case "fact":
			return { kind: "fact", name: e.name };
		case "unary":
			return { kind: "unary", op: e.op, operand: orderExpr(e.operand) };
		case "binary":
			return {
				kind: "binary",
				op: e.op,
				left: orderExpr(e.left),
				right: orderExpr(e.right),
			};
		case "call":
			return { kind: "call", fn: e.fn, args: e.args.map(orderExpr) };
	}
}

function orderFact(def: FactDef): FactDef {
	return {
		type: def.type,
		...(def.ask === undefined ? {} : { ask: def.ask }),
		...(def.why === undefined ? {} : { why: def.why }),
		...(def.derived === undefined ? {} : { derived: def.derived }),
		...(def.options === undefined ? {} : { options: [...def.options] }),
		...(def.role === undefined ? {} : { role: def.role }),
		...(def.label === undefined ? {} : { label: def.label }),
	};
}

function orderRule(rule: ParsedRule): Rule {
	if (rule.toExpr === undefined) throw new NonFinite();
	const to = orderExpr(rule.toExpr);
	return {
		id: rule.id,
		cite: rule.cite,
		set: rule.set,
		to,
		...(rule.whenExpr === undefined ? {} : { when: orderExpr(rule.whenExpr) }),
		because: rule.because,
	};
}

/**
 * Build the KnowledgeBase and its JSON from a validated model. Returns the
 * offending rule's PARSE_ERROR diagnostic if a non-finite literal is found.
 */
export function compileModel(
	model: ParsedKb,
	file: string,
):
	| { readonly ok: true; readonly kb: KnowledgeBase; readonly json: string }
	| { readonly ok: false; readonly diagnostics: readonly Diagnostic[] } {
	const rules: Rule[] = [];
	for (const rule of model.rules) {
		try {
			rules.push(orderRule(rule));
		} catch (error) {
			if (!(error instanceof NonFinite)) throw error;
			return {
				ok: false,
				diagnostics: finalizeDiagnostics([
					makeError(
						"PARSE_ERROR",
						file,
						`Rule '${rule.id}' holds a number literal that is not a finite number.`,
						{ id: rule.id },
					),
				]),
			};
		}
	}

	const facts = Object.fromEntries(
		[...model.facts].map(([name, f]) => [name, orderFact(f.def)]),
	) as Record<string, FactDef>;
	const clauses = Object.fromEntries(
		[...model.clauses].map(([id, c]): [string, Clause] => [
			id,
			{ id, title: c.title, text: c.text },
		]),
	) as Record<string, Clause>;

	const kb: KnowledgeBase = {
		id: model.id,
		...(model.currency === undefined ? {} : { currency: model.currency }),
		goals: [...model.goals],
		facts,
		rules,
		clauses,
	};
	return { ok: true, kb, json: `${JSON.stringify(kb, null, 2)}\n` };
}

/**
 * Validate YAML text once and, if it has no error, compile that same model.
 * Never returns a partial value and never throws on bad input.
 */
export function compileText(text: string, file: string): CompileResult {
	const analysis = analyse({ text }, file);
	if (analysis.model === undefined) {
		return { ok: false, diagnostics: analysis.diagnostics };
	}
	const built = compileModel(analysis.model, file);
	if (!built.ok) {
		return {
			ok: false,
			// Defence in depth only: warnings keep their order, the error follows.
			diagnostics: [...analysis.diagnostics, ...built.diagnostics],
		};
	}
	return {
		ok: true,
		kb: built.kb,
		json: built.json,
		diagnostics: analysis.diagnostics,
	};
}
