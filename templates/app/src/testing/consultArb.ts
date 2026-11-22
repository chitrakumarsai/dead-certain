// Test-only. Sessions reached by running real consultations with valid answers.
import {
	answer,
	type FactDef,
	type FactValue,
	type KnowledgeBase,
	next,
	type Session,
	start,
} from "@dead-certain/engine";
import fc from "fast-check";

const ISO_DAY = 86_400_000;
const FIRST_DAY = Date.UTC(2018, 0, 1);

export function valueArb(def: FactDef): fc.Arbitrary<FactValue> {
	switch (def.type) {
		case "boolean":
			return fc.boolean();
		case "money":
			// Whole units in minor units, up to 5,000,000.
			return fc.integer({ min: 0, max: 5_000_000 }).map((r) => r * 100);
		case "number":
			return fc.integer({ min: 0, max: 120 });
		case "date":
			return fc
				.integer({ min: 0, max: 365 * 9 })
				.map((d) =>
					new Date(FIRST_DAY + d * ISO_DAY).toISOString().slice(0, 10),
				);
		case "enum":
			return fc.constantFrom(...(def.options ?? []));
	}
}

/** A session after answering up to `stopAfter` questions, each with a valid value. */
export function consultArb(
	kb: KnowledgeBase,
	stopAfter = Number.POSITIVE_INFINITY,
	overrides: Readonly<Record<string, fc.Arbitrary<FactValue>>> = {},
): fc.Arbitrary<Session> {
	return fc.gen().map((gen) => {
		let s = start(kb);
		for (let asked = 0; asked < stopAfter; asked++) {
			const step = next(s);
			if (step.kind === "verdict") break;
			const def = kb.facts[step.fact];
			if (def === undefined) throw new Error(`no definition for ${step.fact}`);
			const own = overrides[step.fact];
			s = answer(s, step.fact, own ? gen(() => own) : gen(valueArb, def));
		}
		return s;
	});
}

/** One fixed valid value per type, so tests can walk any knowledge base without naming a fact. */
export function plainValue(def: FactDef): FactValue {
	switch (def.type) {
		case "boolean":
			return true;
		case "money":
			return 100_00;
		case "number":
			return 1;
		case "date":
			return "2024-01-01";
		case "enum":
			return def.options?.[0] ?? "";
	}
}

/** The answers given by taking `plainValue` for up to `stopAfter` questions. */
export function plainAnswers(
	kb: KnowledgeBase,
	stopAfter = Number.POSITIVE_INFINITY,
): Record<string, FactValue> {
	let s = start(kb);
	for (let asked = 0; asked < stopAfter; asked++) {
		const step = next(s);
		if (step.kind === "verdict") break;
		const def = kb.facts[step.fact];
		if (def === undefined) throw new Error(`no definition for ${step.fact}`);
		s = answer(s, step.fact, plainValue(def));
	}
	return { ...s.answers };
}
