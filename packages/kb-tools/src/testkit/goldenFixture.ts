import type { KnowledgeBase } from "@dead-certain/engine";
import { compileText } from "../compile";
import type { GoldenSet, Scenario } from "../golden/model";
import { recordScenario } from "./golden";
import { renderDoc } from "./render";

/**
 * A small knowledge base for the golden tests: five askable fact types, a
 * rounded money rule, guards, fallbacks, two deductions, a check and two goals.
 */
export const FIXTURE_KB_TEXT = `id: fixture
currency: INR
goals: [payable_amount, verdict]

facts:
  claimed: { type: money, ask: What is the claimed amount? }
  sum_insured: { type: money, ask: What is the sum insured? }
  room_rent_per_day: { type: money, ask: What was the room rent per day? }
  age: { type: number, ask: How old is the policyholder? }
  tier: { type: enum, ask: Which tier is the policy?, options: [gold, silver] }
  policy_start: { type: date, ask: When did the policy start? }
  admission_date: { type: date, ask: When was the patient admitted? }
  rent_cap: { type: money, derived: true }
  room_rent_deduction:
    type: money
    derived: true
    role: deduction
    label: Room rent over the limit
  copay_deduction:
    type: money
    derived: true
    role: deduction
    label: Co-payment
  in_waiting_period:
    type: boolean
    derived: true
    role: check
    label: Waiting period has passed
  payable_amount: { type: money, derived: true }
  verdict: { type: enum, derived: true, options: [paid, reduced, denied] }

rules:
  - id: CAP-01
    cite: "4.2"
    set: rent_cap
    to: round(sum_insured / 100)
    because: The room rent limit is 1% of the sum insured.
  - id: ROOM-01
    cite: "4.2"
    set: room_rent_deduction
    when: room_rent_per_day > rent_cap
    to: round((room_rent_per_day - rent_cap) * 3)
    because: Rent of {room_rent_per_day} is above the limit of {rent_cap}.
  - id: ROOM-02
    cite: "4.2"
    set: room_rent_deduction
    to: 0
    because: The rent is within the limit.
  - id: COPAY-01
    cite: "6.1"
    set: copay_deduction
    when: age >= 61
    to: round((claimed - room_rent_deduction) / 10)
    because: Policyholders aged 61 or over pay 10% of the rest.
  - id: COPAY-02
    cite: "6.1"
    set: copay_deduction
    to: 0
    because: No co-payment under age 61.
  - id: WAIT-01
    cite: "2.2"
    set: in_waiting_period
    to: days_between(policy_start, admission_date) < 30
    because: The claim is within 30 days of the policy start.
  - id: PAY-01
    cite: "1.2"
    set: payable_amount
    when: in_waiting_period
    to: 0
    because: Nothing is paid inside the waiting period.
  - id: PAY-02
    cite: "1.2"
    set: payable_amount
    to: claimed - room_rent_deduction - copay_deduction
    because: The claim less its deductions is paid.
  - id: VER-01
    cite: "1.2"
    set: verdict
    when: in_waiting_period
    to: "'denied'"
    because: The claim is inside the waiting period.
  - id: VER-02
    cite: "1.2"
    set: verdict
    when: room_rent_deduction + copay_deduction > 0
    to: "'reduced'"
    because: The claim is reduced by its deductions.
  - id: VER-03
    cite: "1.2"
    set: verdict
    to: "'paid'"
    because: The claim is paid in full.

clauses:
  "1.2": { title: Payment, text: The insurer pays the claim less its deductions. }
  "2.2": { title: Waiting period, text: Nothing is paid in the first 30 days. }
  "4.2": { title: Room rent limit, text: Room rent is covered up to 1% of the sum insured per day. }
  "6.1": { title: Co-payment, text: Policyholders aged 61 or over pay 10% of the claim. }
`;

/** The compiled fixture knowledge base. Throws if the fixture stops compiling. */
export function fixtureKb(): KnowledgeBase {
	const result = compileText(FIXTURE_KB_TEXT, "apps/fixture/kb/fixture.yaml");
	if (!result.ok) {
		throw new Error(
			`the golden fixture does not compile: ${result.diagnostics.map((d) => `${d.code} ${d.message}`).join("; ")}`,
		);
	}
	return result.kb;
}

const FULL = {
	claimed: 21000000,
	sum_insured: 500000,
	room_rent_per_day: 600000,
	age: 65,
	tier: "gold",
	policy_start: "2024-01-01",
	admission_date: "2024-06-01",
} as const;

/** Twelve runs that between them make every rule of the fixture fire. */
const FIXTURE_RUNS = [
	["consult", FULL],
	["audit", { ...FULL, age: 30, room_rent_per_day: 1000, claimed: 100 }],
	["audit", { ...FULL, admission_date: "2024-01-10" }],
	["audit", { ...FULL, age: 30 }],
	["audit", { ...FULL, room_rent_per_day: 4000 }],
	["consult", { claimed: 100 }],
	["audit", { claimed: 100 }],
	["consult", { ...FULL, tier: "silver" }],
	["audit", { ...FULL, room_rent_per_day: 5000, age: 61 }],
	["audit", { ...FULL, room_rent_per_day: 5001, age: 60 }],
	["consult", { ...FULL, claimed: 0, age: 80 }],
	[
		"audit",
		{ ...FULL, policy_start: "2024-05-02", admission_date: "2024-06-01" },
	],
] as const;

/** Twelve recorded scenarios, G-1 to G-12, that cover every rule of the fixture. */
export function fixtureScenarios(): Scenario[] {
	const kb = fixtureKb();
	return FIXTURE_RUNS.map(([mode, facts], i) => {
		const scenario = recordScenario(kb, facts, mode, `G-${i + 1}`);
		if (scenario === undefined) throw new Error(`fixture run ${i + 1} fails`);
		return scenario;
	});
}

/** A golden set as YAML text, the way an author would write it. */
export function goldenYaml(set: GoldenSet): string {
	return renderDoc({
		kb: set.kb,
		scenarios: set.scenarios.map((s) => ({
			id: s.id,
			title: s.title,
			mode: s.mode,
			facts: s.facts,
			expect:
				"ask" in s.expect
					? { ask: s.expect.ask }
					: {
							goals: s.expect.goals,
							...(s.expect.lineItems === undefined
								? {}
								: { line_items: s.expect.lineItems }),
							...(s.expect.needed === undefined
								? {}
								: { needed: s.expect.needed }),
							...(s.expect.fires === undefined
								? {}
								: { fires: s.expect.fires }),
						},
		})),
	});
}
