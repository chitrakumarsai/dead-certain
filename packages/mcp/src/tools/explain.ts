import {
	explain,
	type FactSource,
	type FactValue,
	type KnowledgeBase,
	type ProofNode,
} from "@dead-certain/engine";
import { parseFact, parseSessionArgs } from "../args";
import { guard } from "../guard";
import { compile } from "../kbs";
import { type JsonObject, ok, type ToolResult } from "../payload";
import type { Workspace } from "../workspace";
import { buildSession } from "./consult";

/** A proof node as JSON: absent parts are omitted, unknown is null. */
export type ProofOut = {
	fact: string;
	value: FactValue | null;
	source: FactSource;
	rule?: string;
	clause?: string;
	because?: string;
	children: ProofOut[];
};

function proofOut(node: ProofNode): ProofOut {
	return {
		fact: node.fact,
		value: node.value ?? null,
		source: node.source,
		...(node.rule === undefined ? {} : { rule: node.rule }),
		...(node.clause === undefined ? {} : { clause: node.clause }),
		...(node.because === undefined ? {} : { because: node.because }),
		children: node.children.map(proofOut),
	};
}

/**
 * One node per line, two spaces per depth:
 * `<fact> = <value> [<source>]`, then ` by <rule> (clause <clause>): <because>`
 * when the node has a rule. An unknown value prints as `unknown`.
 */
export function proofText(node: ProofOut, depth = 0): string {
	const value = node.value === null ? "unknown" : String(node.value);
	const by =
		node.rule === undefined
			? ""
			: ` by ${node.rule} (clause ${node.clause ?? "?"}): ${node.because ?? ""}`;
	const line = `${"  ".repeat(depth)}${node.fact} = ${value} [${node.source}]${by}\n`;
	return line + node.children.map((c) => proofText(c, depth + 1)).join("");
}

/** Title and text of each clause cited in the tree, in order of first citation. */
function citedClauses(kb: KnowledgeBase, root: ProofOut): JsonObject {
	const out: JsonObject = {};
	const visit = (node: ProofOut): void => {
		const id = node.clause;
		if (id !== undefined && !Object.hasOwn(out, id)) {
			const clause = Object.hasOwn(kb.clauses, id) ? kb.clauses[id] : undefined;
			if (clause !== undefined) {
				Object.defineProperty(out, id, {
					value: { title: clause.title, text: clause.text },
					enumerable: true,
					writable: true,
					configurable: true,
				});
			}
		}
		for (const child of node.children) visit(child);
	};
	visit(root);
	return out;
}

/** `explain`: the proof of one fact, as JSON and as an outline. */
export function explainFact(ws: Workspace, args: unknown): ToolResult {
	return guard(() => {
		const parsed = parseSessionArgs(args);
		if (!parsed.ok) return parsed.error;
		const fact = parseFact(args);
		if (!fact.ok) return fact.error;
		const compiled = compile(ws, parsed.value.kb);
		if (!compiled.ok) return compiled.error;
		const session = buildSession(
			compiled.kb,
			parsed.value.answers,
			parsed.value.token,
		);
		const proof = proofOut(explain(session, fact.value));
		return ok({
			fact: fact.value,
			value: proof.value,
			proof: proof as unknown as JsonObject,
			text: proofText(proof),
			clauses: citedClauses(compiled.kb, proof),
		});
	});
}
