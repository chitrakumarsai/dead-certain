import { describe, expect, it } from "vitest";
import { whatIf } from "./api";
import { parse } from "./lang/parse";
import { Resolver } from "./resolve";
import { thresholdCandidates } from "./thresholds";
import type {
	Expr,
	FactDef,
	FactValue,
	KnowledgeBase,
	Rule,
	Session,
} from "./types";

function expr(src: string): Expr {
	const r = parse(src);
	if (!r.ok) throw new Error(`parse failed: ${r.error.message}`);
	return r.expr;
}

function rule(id: string, set: string, to: string, when?: string): Rule {
	return {
		id,
		cite: `c-${id}`,
		set,
		to: expr(to),
		...(when === undefined ? {} : { when: expr(when) }),
		because: `because ${id}`,
	};
}

function makeKb(
	goals: string[],
	facts: Record<string, FactDef>,
	rules: Rule[],
): KnowledgeBase {
	return {
		id: "what-if-thresholds",
		goals,
		facts,
		rules,
		clauses: Object.fromEntries(
			rules.map((r) => [r.cite, { id: r.cite, title: r.id, text: r.id }]),
		),
	};
}

function candidates(
	kb: KnowledgeBase,
	answers: Record<string, FactValue>,
	fact: string,
): FactValue[] {
	return thresholdCandidates(kb, new Resolver(kb, answers), answers, fact);
}

// Claim Check style: room rent against a cap of 500000 paise (₹5,000 a day).
const claimKb = makeKb(
	["payout"],
	{
		room_rent: { type: "money", ask: "Room rent per day?" },
		claim: { type: "money", ask: "Claimed amount?" },
		limit: { type: "money", derived: true },
		within_cap: {
			type: "boolean",
			derived: true,
			role: "check",
			label: "Room rent at or below the limit",
		},
		payout: { type: "money", derived: true },
	},
	[
		rule("r-limit", "limit", "500000"),
		rule("r-cap", "within_cap", "room_rent <= limit"),
		rule("r-payout", "payout", "if(within_cap, claim, claim - 3800000)"),
	],
);

describe("whatIf: money threshold against a Known_Value of 500000", () => {
	it("probes 499999, 500000 and 500001 for room rent", () => {
		expect(
			candidates(claimKb, { room_rent: 600000, claim: 5000000 }, "room_rent"),
		).toEqual([499999, 500000, 500001]);
	});

	it("excludes the current answer from the candidates", () => {
		expect(
			candidates(claimKb, { room_rent: 500000, claim: 5000000 }, "room_rent"),
		).toEqual([499999, 500001]);
	});

	it("keeps only the Alternatives whose Verdict changes", () => {
		const s: Session = {
			kb: claimKb,
			answers: { room_rent: 600000, claim: 5000000 },
		};
		const alts = whatIf(s);
		// 500001 is still above the cap, so its Verdict equals the base one.
		expect(alts.map((a) => [a.fact, a.value])).toEqual([
			["room_rent", 499999],
			["room_rent", 500000],
		]);
		for (const a of alts) {
			expect(a.verdict.goals.payout).toBe(5000000);
			const line = a.verdict.lineItems.find((l) => l.fact === "within_cap");
			expect(line?.label).toBe("Room rent at or below the limit");
			expect(line?.value).toBe(true);
			expect(line?.rule).toBe("r-cap");
		}
	});

	it("shows the change from the base verdict (payout 1200000 to 5000000)", () => {
		const s: Session = {
			kb: claimKb,
			answers: { room_rent: 600000, claim: 5000000 },
		};
		const base = whatIf({
			kb: claimKb,
			answers: { room_rent: 499999, claim: 5000000 },
		});
		// From inside the cap, 500001 is the only change that alters the Verdict.
		expect(base.map((a) => a.value)).toEqual([500001]);
		expect(base[0]?.verdict.goals.payout).toBe(1200000);
		expect(whatIf(s)[0]?.verdict.goals.payout).toBe(5000000);
	});

	it("leaves the Session unchanged and gives no Alternative without answers", () => {
		const s: Session = {
			kb: claimKb,
			answers: { room_rent: 600000, claim: 5000000 },
		};
		const before = JSON.stringify(s.answers);
		whatIf(s);
		expect(JSON.stringify(s.answers)).toBe(before);
		expect(whatIf({ kb: claimKb, answers: {} })).toEqual([]);
	});
});

describe("threshold candidate exclusions", () => {
	it("never offers negative money: a Known_Value of 0 gives no -1", () => {
		const kb = makeKb(
			["ok"],
			{
				x: { type: "money", ask: "x?" },
				ok: { type: "boolean", derived: true },
			},
			[rule("r-ok", "ok", "x > 0")],
		);
		expect(candidates(kb, { x: 700 }, "x")).toEqual([0, 1]);
	});

	it("offers no date outside years 0001 to 9999", () => {
		const low = makeKb(
			["ok"],
			{
				d: { type: "date", ask: "d?" },
				ok: { type: "boolean", derived: true },
			},
			[rule("r-ok", "ok", 'd > "0001-01-01"')],
		);
		expect(candidates(low, { d: "2024-05-05" }, "d")).toEqual([
			"0001-01-01",
			"0001-01-02",
		]);
		const high = makeKb(
			["ok"],
			{
				d: { type: "date", ask: "d?" },
				ok: { type: "boolean", derived: true },
			},
			[rule("r-ok", "ok", 'd < "9999-12-31"')],
		);
		expect(candidates(high, { d: "2024-05-05" }, "d")).toEqual([
			"9999-12-30",
			"9999-12-31",
		]);
	});

	it("gives the previous and next calendar day across a leap day", () => {
		const kb = makeKb(
			["ok"],
			{
				d: { type: "date", ask: "d?" },
				ok: { type: "boolean", derived: true },
			},
			[rule("r-ok", "ok", 'd >= "2024-03-01"')],
		);
		expect(candidates(kb, { d: "2000-01-01" }, "d")).toEqual([
			"2024-02-29",
			"2024-03-01",
			"2024-03-02",
		]);
	});

	it("caps the list at the first 6 ascending values", () => {
		const kb = makeKb(
			["ok"],
			{
				x: { type: "number", ask: "x?" },
				ok: { type: "boolean", derived: true },
			},
			[
				rule("r-a", "ok", "x > 100"),
				rule("r-b", "ok", "x > 200"),
				rule("r-c", "ok", "x > 300"),
				rule("r-d", "ok", "x > 400"),
			],
		);
		const got = candidates(kb, { x: 1000 }, "x");
		expect(got).toEqual([99, 100, 101, 199, 200, 201]);
		expect(got).toHaveLength(6);
	});

	it("gives none when the other side is Unknown", () => {
		const kb = makeKb(
			["ok"],
			{
				x: { type: "number", ask: "x?" },
				y: { type: "number", ask: "y?" },
				ok: { type: "boolean", derived: true },
			},
			[rule("r-ok", "ok", "x > y")],
		);
		expect(candidates(kb, { x: 5 }, "x")).toEqual([]);
		// Once y is answered, the probe yields candidates.
		expect(candidates(kb, { x: 5, y: 10 }, "x")).toEqual([9, 10, 11]);
	});

	it("gives none when the other side depends on the answered fact", () => {
		const kb = makeKb(
			["ok", "ok2"],
			{
				x: { type: "number", ask: "x?" },
				twice: { type: "number", derived: true },
				ok: { type: "boolean", derived: true },
				ok2: { type: "boolean", derived: true },
			},
			[
				rule("r-twice", "twice", "x * 2"),
				rule("r-ok", "ok", "x < twice"),
				rule("r-ok2", "ok2", "x <= x + 1"),
			],
		);
		expect(candidates(kb, { x: 5 }, "x")).toEqual([]);
	});

	it("gives none for an erroring other side without throwing", () => {
		const kb = makeKb(
			["ok"],
			{
				x: { type: "number", ask: "x?" },
				z: { type: "number", ask: "z?" },
				ok: { type: "boolean", derived: true },
			},
			[rule("r-ok", "ok", "x > 10 / z")],
		);
		expect(candidates(kb, { x: 5, z: 0 }, "x")).toEqual([]);
	});
});
