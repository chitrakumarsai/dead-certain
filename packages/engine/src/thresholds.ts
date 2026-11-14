import { addDays } from "./calendar";
import { EngineError } from "./errors";
import { factRefs } from "./graph";
import { isValidDate } from "./lang/dates";
import type { Resolver } from "./resolve";
import type { BinaryOp, Expr, FactValue, KnowledgeBase } from "./types";
import { UNKNOWN } from "./types";
import { hasOwn } from "./util";

const PROBE_OPS: ReadonlySet<BinaryOp> = new Set<BinaryOp>([
	"<",
	"<=",
	">",
	">=",
	"==",
	"!=",
]);

const MAX_CANDIDATES = 6;

interface Probe {
	readonly other: Expr;
	readonly ruleId: string;
}

/** Every binary comparison node in an expression, iteratively. */
function binaries(expr: Expr, out: Extract<Expr, { kind: "binary" }>[]): void {
	const stack: Expr[] = [expr];
	while (stack.length > 0) {
		const node = stack.pop() as Expr;
		switch (node.kind) {
			case "literal":
			case "fact":
				break;
			case "unary":
				stack.push(node.operand);
				break;
			case "binary":
				out.push(node);
				stack.push(node.right, node.left);
				break;
			case "call":
				for (const a of node.args) stack.push(a);
				break;
		}
	}
}

function isFactNode(e: Expr, name: string): boolean {
	return e.kind === "fact" && e.name === name;
}

/** True when `target` is in the transitive reference closure of `expr`. */
function dependsOn(kb: KnowledgeBase, expr: Expr, target: string): boolean {
	const visited = new Set<string>();
	const queue = [...factRefs(expr)];
	while (queue.length > 0) {
		const name = queue.pop() as string;
		if (name === target) return true;
		if (visited.has(name)) continue;
		visited.add(name);
		for (const rule of kb.rules) {
			if (rule.set !== name) continue;
			if (rule.when !== undefined) queue.push(...factRefs(rule.when));
			queue.push(...factRefs(rule.to));
		}
	}
	return false;
}

function isValidCandidate(type: string, v: FactValue): boolean {
	switch (type) {
		case "number":
			return typeof v === "number" && Number.isFinite(v);
		case "money":
			return typeof v === "number" && Number.isSafeInteger(v) && v >= 0;
		case "date":
			return typeof v === "string" && isValidDate(v);
		default:
			return false;
	}
}

/**
 * Threshold_Candidates for an answered number, money or date fact: values
 * taken from comparisons in the rules, de-duplicated, validated, sorted
 * ascending and capped at 6 before any Verdict is computed.
 */
export function thresholdCandidates(
	kb: KnowledgeBase,
	r: Resolver,
	answers: Readonly<Record<string, FactValue>>,
	fact: string,
): FactValue[] {
	const def = hasOwn(kb.facts, fact) ? kb.facts[fact] : undefined;
	if (def === undefined) return [];
	const type = def.type;
	if (type !== "number" && type !== "money" && type !== "date") return [];

	const probes: Probe[] = [];
	for (const rule of kb.rules) {
		const nodes: Extract<Expr, { kind: "binary" }>[] = [];
		if (rule.when !== undefined) binaries(rule.when, nodes);
		binaries(rule.to, nodes);
		for (const node of nodes) {
			if (!PROBE_OPS.has(node.op)) continue;
			if (isFactNode(node.left, fact)) {
				probes.push({ other: node.right, ruleId: rule.id });
			}
			if (isFactNode(node.right, fact)) {
				probes.push({ other: node.left, ruleId: rule.id });
			}
		}
	}

	const found: FactValue[] = [];
	for (const probe of probes) {
		if (dependsOn(kb, probe.other, fact)) continue;
		let v: FactValue | typeof UNKNOWN;
		try {
			v = r.expr(probe.other, probe.ruleId);
		} catch (e) {
			if (e instanceof EngineError) continue;
			throw e;
		}
		if (v === UNKNOWN) continue;
		found.push(v);
		if (type === "date") {
			if (typeof v !== "string") continue;
			const prev = addDays(v, -1);
			const next = addDays(v, 1);
			if (prev !== undefined) found.push(prev);
			if (next !== undefined) found.push(next);
		} else if (typeof v === "number") {
			found.push(v - 1, v + 1);
		}
	}

	const current = hasOwn(answers, fact) ? answers[fact] : undefined;
	const unique = new Set<FactValue>();
	for (const v of found) {
		if (v === current || !isValidCandidate(type, v)) continue;
		unique.add(v);
	}

	const sorted = [...unique].sort((a, b) => {
		if (typeof a === "number" && typeof b === "number") return a - b;
		const sa = String(a);
		const sb = String(b);
		return sa < sb ? -1 : sa > sb ? 1 : 0;
	});
	return sorted.slice(0, MAX_CANDIDATES);
}
