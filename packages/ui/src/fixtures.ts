// Fixture data shaped like engine output, so the interface can be built before the engine exists.
// Sample amounts from BUILD_PLAN section 8, in paise.
import type { ProofNode, Question, Verdict } from "@dead-certain/engine/types";

export const CLAIMED_AMOUNT = 210_000_00;

export const questionFixture: Question = {
	kind: "question",
	fact: "room_rent_per_day",
	text: "What was the room rent per day?",
	why: "The policy caps room rent, and a higher rent reduces other charges too.",
	clause: "4.2",
};

export const claimVerdictFixture: Verdict = {
	kind: "verdict",
	goals: { payable_amount: 142_500_00, verdict: "reduced" },
	lineItems: [
		{
			fact: "room_rent_deduction",
			role: "deduction",
			label: "Room rent above the limit",
			value: 38_000_00,
			rule: "ROOM-03",
			clause: "4.2",
		},
		{
			fact: "copay_deduction",
			role: "deduction",
			label: "Co-payment at age 61 or over",
			value: 29_500_00,
			rule: "COPAY-01",
			clause: "6.1",
		},
	],
	needed: [],
};

export const proofFixture: ProofNode = {
	fact: "room_rent_deduction",
	value: 38_000_00,
	source: "derived",
	rule: "ROOM-03",
	clause: "4.2",
	because: "Other charges reduce in the same ratio as the room rent.",
	children: [
		{
			fact: "rent_over_cap",
			value: true,
			source: "derived",
			rule: "ROOM-02",
			clause: "4.2",
			because: "Room rent of ₹6,000 is above the limit of ₹5,000.",
			children: [
				{
					fact: "room_rent_per_day",
					value: 6_000_00,
					source: "answered",
					children: [],
				},
			],
		},
		{
			fact: "room_rent_cap",
			value: 5_000_00,
			source: "derived",
			rule: "ROOM-01",
			clause: "4.2",
			because: "The room rent limit is 1% of the sum insured per day.",
			children: [
				{
					fact: "sum_insured",
					value: 500_000_00,
					source: "answered",
					children: [],
				},
			],
		},
	],
};

export const preFlightVerdictFixture: Verdict = {
	kind: "verdict",
	goals: { verdict: "not_ready" },
	lineItems: [
		{
			fact: "is_public",
			role: "check",
			label: "Public repository",
			value: true,
			rule: "R-01",
			clause: "1.1",
		},
		{
			fact: "has_detectable_license",
			role: "check",
			label: "License file GitHub can detect",
			value: false,
			rule: "R-02",
			clause: "1.2",
		},
		{
			fact: "kiro_not_ignored",
			role: "check",
			label: ".kiro is not ignored",
			value: false,
			rule: "R-05",
			clause: "2.2",
		},
		{
			fact: "video_under_3_minutes",
			role: "check",
			label: "Demo video under 3 minutes",
			value: undefined,
			rule: "R-09",
			clause: "4.1",
		},
	],
	needed: [
		{
			kind: "question",
			fact: "video_under_3_minutes",
			text: "Is the demo video under 3 minutes?",
		},
	],
};

const SUM_INSURED = 500_000_00;

const sumInsuredAnswer: ProofNode = {
	fact: "sum_insured",
	value: SUM_INSURED,
	source: "answered",
	children: [],
};

/** Four levels deep, with `sum_insured` used by two different rules. */
export const deepProofFixture: ProofNode = {
	fact: "payable_amount",
	value: 142_500_00,
	source: "derived",
	rule: "PAY-01",
	clause: "1.2",
	because: "The payable amount is the claim less each deduction.",
	children: [
		{
			fact: "room_rent_deduction",
			value: 38_000_00,
			source: "derived",
			rule: "ROOM-03",
			clause: "4.2",
			because: "Other charges reduce in the same ratio as the room rent.",
			children: [
				{
					fact: "room_rent_cap",
					value: 5_000_00,
					source: "derived",
					rule: "ROOM-01",
					clause: "4.2",
					because: "The room rent limit is 1% of the sum insured per day.",
					children: [sumInsuredAnswer],
				},
			],
		},
		{
			fact: "within_sum_insured",
			value: true,
			source: "derived",
			rule: "LIMIT-01",
			clause: "2.2",
			because: "The claim is within the sum insured.",
			children: [sumInsuredAnswer],
		},
	],
};

const HUGE_JOINTS = 18;
const HUGE_LEAVES_PER_JOINT = 10;

/** 200 nodes: a root, 18 rules with 10 answers each, and one direct answer. */
export const hugeProofFixture: ProofNode = {
	fact: "payable_amount",
	value: 142_500_00,
	source: "derived",
	rule: "PAY-01",
	because: "The payable amount is the claim less each deduction.",
	children: [
		...Array.from(
			{ length: HUGE_JOINTS },
			(_, joint): ProofNode => ({
				fact: `deduction_${joint + 1}`,
				value: (joint + 1) * 1_000_00,
				source: "derived",
				rule: `DED-${String(joint + 1).padStart(2, "0")}`,
				because: `Deduction ${joint + 1} applies to this claim.`,
				children: Array.from(
					{ length: HUGE_LEAVES_PER_JOINT },
					(_, leaf): ProofNode => ({
						fact: `charge_${joint + 1}_${leaf + 1}`,
						value: (leaf + 1) * 100_00,
						source: "answered",
						children: [],
					}),
				),
			}),
		),
		sumInsuredAnswer,
	],
};
