import { EngineError } from "./errors";
import { findCycle } from "./graph";
import { isValidDate } from "./lang/dates";
import type { FactDef, FactValue, KnowledgeBase } from "./types";
import { hasOwn } from "./util";

/**
 * Checks the Knowledge_Base, throwing on the first failure in this order:
 * an unknown goal, an unknown rule `set`, then a dependency cycle.
 */
export function validateKb(kb: KnowledgeBase): void {
	for (const goal of kb.goals) {
		if (!hasOwn(kb.facts, goal)) {
			throw new EngineError(
				"INVALID_KB",
				`Goal "${goal}" names a fact that is not in the knowledge base.`,
			);
		}
	}
	for (const rule of kb.rules) {
		if (!hasOwn(kb.facts, rule.set)) {
			throw new EngineError(
				"INVALID_KB",
				`Rule "${rule.id}" sets "${rule.set}", which is not a fact in the knowledge base.`,
			);
		}
	}
	const cycle = findCycle(kb);
	if (cycle !== undefined) {
		throw new EngineError(
			"CYCLE",
			`Dependency cycle through facts: ${cycle.join(", ")}.`,
		);
	}
}

/** True when `value` is a legal answer for a fact of this definition. */
function isValidValue(def: FactDef, value: unknown): boolean {
	switch (def.type) {
		case "boolean":
			return typeof value === "boolean";
		case "number":
			return typeof value === "number" && Number.isFinite(value);
		case "money":
			return typeof value === "number" && Number.isSafeInteger(value);
		case "date":
			return typeof value === "string" && isValidDate(value);
		case "enum":
			return (
				typeof value === "string" &&
				def.options !== undefined &&
				def.options.includes(value)
			);
		default:
			return false;
	}
}

/**
 * Checks one answer. Throws `UNKNOWN_FACT`, `NOT_ANSWERABLE` or
 * `INVALID_ANSWER`, checked in that order. `undefined`, `null`, symbols
 * (including `UNKNOWN`), `NaN` and infinities are always invalid.
 */
export function checkValue(
	kb: KnowledgeBase,
	fact: string,
	value: unknown,
): void {
	if (!hasOwn(kb.facts, fact)) {
		throw new EngineError(
			"UNKNOWN_FACT",
			`Fact "${fact}" is not in the knowledge base.`,
		);
	}
	const def = kb.facts[fact] as FactDef;
	if (def.derived === true) {
		throw new EngineError(
			"NOT_ANSWERABLE",
			`Fact "${fact}" is derived by rules and cannot be answered.`,
		);
	}
	if (!isValidValue(def, value)) {
		throw new EngineError(
			"INVALID_ANSWER",
			`Value for fact "${fact}" is not a valid ${def.type}.`,
		);
	}
}

/**
 * Checks a whole answers record in three passes over the names, sorted by
 * code-unit order: unknown names, then derived names, then bad values.
 */
export function validateAnswers(
	kb: KnowledgeBase,
	answers: Readonly<Record<string, unknown>>,
): void {
	const names = Object.keys(answers).sort();
	for (const name of names) {
		if (!hasOwn(kb.facts, name)) {
			throw new EngineError(
				"UNKNOWN_FACT",
				`Fact "${name}" is not in the knowledge base.`,
			);
		}
	}
	for (const name of names) {
		if ((kb.facts[name] as FactDef).derived === true) {
			throw new EngineError(
				"NOT_ANSWERABLE",
				`Fact "${name}" is derived by rules and cannot be answered.`,
			);
		}
	}
	for (const name of names) {
		checkValue(kb, name, answers[name]);
	}
}

/** Stores `-0` as `0`. Every other value is returned unchanged. */
export function normaliseValue(value: FactValue): FactValue {
	return typeof value === "number" && Object.is(value, -0) ? 0 : value;
}
