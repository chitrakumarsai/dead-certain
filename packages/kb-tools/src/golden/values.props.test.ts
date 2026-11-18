import { answer, EngineError, start } from "@dead-certain/engine";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { compileText } from "../index";
import { checkValue, isCalendarDate } from "./values";

const RUNS = { numRuns: 300 };

const KB_TEXT = `id: values
currency: INR
goals: [out]
facts:
  b: { type: boolean, ask: "b?" }
  n: { type: number, ask: "n?" }
  m: { type: money, ask: "m?" }
  d: { type: date, ask: "d?" }
  e: { type: enum, ask: "e?", options: [alpha, beta, gamma] }
  out: { type: boolean, derived: true }
rules:
  - id: R-1
    cite: "1.1"
    set: out
    to: b
    because: Out follows b.
clauses:
  "1.1": { title: Title, text: Text. }
`;

const compiled = compileText(KB_TEXT, "apps/values/kb/values.yaml");
if (!compiled.ok) throw new Error("the values knowledge base must compile");
const kb = compiled.kb;

/** True when the engine takes `value` as an answer for `fact`. */
function engineAccepts(fact: string, value: unknown): boolean {
	try {
		answer(start(kb), fact, value as never);
		return true;
	} catch (error) {
		if (error instanceof EngineError && error.code === "INVALID_ANSWER") {
			return false;
		}
		throw error;
	}
}

const dateLike = fc
	.tuple(
		fc.integer({ min: 0, max: 9999 }),
		fc.integer({ min: 0, max: 14 }),
		fc.integer({ min: 0, max: 35 }),
	)
	.map(
		([y, m, d]) =>
			`${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
	);

const valueArb = fc.oneof(
	fc.boolean(),
	fc.integer(),
	fc.double(),
	fc.constantFrom(
		Number.NaN,
		Number.POSITIVE_INFINITY,
		Number.NEGATIVE_INFINITY,
		-0,
		1e21,
		2 ** 53,
		-(2 ** 53),
	),
	fc.string(),
	dateLike,
	fc.constantFrom("alpha", "beta", "gamma", "delta", ""),
	fc.constant(null),
	fc.constant(undefined),
	fc.constant([]),
	fc.constant({}),
);

describe("Property 9: Accepted dates are real dates the engine accepts", () => {
	// Feature: kb-golden, Property 9: Accepted dates are real dates the engine accepts
	it("accepts a date text if and only if the engine accepts it, for well-formed texts", () => {
		fc.assert(
			fc.property(dateLike, (text) => {
				expect(isCalendarDate(text)).toBe(engineAccepts("d", text));
			}),
			RUNS,
		);
	});

	it("never accepts a string the engine refuses as a date", () => {
		fc.assert(
			fc.property(fc.string(), (text) => {
				if (isCalendarDate(text)) expect(engineAccepts("d", text)).toBe(true);
			}),
			RUNS,
		);
	});

	it("accepts a value for a fact only if the engine accepts it", () => {
		fc.assert(
			fc.property(
				valueArb,
				fc.constantFrom("b", "n", "m", "d", "e"),
				(value, fact) => {
					const def = kb.facts[fact];
					if (def === undefined) throw new Error("fact missing");
					if (checkValue(def, value) === undefined) {
						expect(engineAccepts(fact, value)).toBe(true);
					}
				},
			),
			RUNS,
		);
	});

	it("rejects nothing the engine would take, for boolean, enum and date facts", () => {
		fc.assert(
			fc.property(valueArb, fc.constantFrom("b", "e", "d"), (value, fact) => {
				const def = kb.facts[fact];
				if (def === undefined) throw new Error("fact missing");
				if (engineAccepts(fact, value)) {
					expect(checkValue(def, value)).toBeUndefined();
				}
			}),
			RUNS,
		);
	});

	it("is the same as the engine for the edge values of numbers and money", () => {
		for (const value of [-0, 0, 1.5, 1e21, 2 ** 53, 2 ** 53 - 1, Number.NaN]) {
			for (const fact of ["n", "m"]) {
				const def = kb.facts[fact];
				if (def === undefined) throw new Error("fact missing");
				if (checkValue(def, value) === undefined) {
					expect(engineAccepts(fact, value), `${fact} ${value}`).toBe(true);
				}
			}
		}
		expect(true).toBe(true);
	});
});
