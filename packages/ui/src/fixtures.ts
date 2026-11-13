// Fixture data shaped like engine output, so the interface can be built before the engine exists.
// Sample amounts from BUILD_PLAN section 8, in paise.
import type {
	Alternative,
	Clause,
	FactDef,
	ProofNode,
	Question,
	Verdict,
} from "@dead-certain/engine/types";
import type { AnswerEntry, SkippedNote } from "./types";

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

// Sample clause text written for this project. Not from any real policy.
/** Claim Check clauses cited by the Claim Check fixtures. */
export const clauseFixtures: Readonly<Record<string, Clause>> = {
	"1.2": {
		id: "1.2",
		title: "What the policy pays",
		text: "The policy pays the hospital bill less every deduction set out in this policy.",
	},
	"2.2": {
		id: "2.2",
		title: "Sum insured",
		text: "The most the policy pays in one policy year is the sum insured shown in the schedule.",
	},
	"4.2": {
		id: "4.2",
		title: "Room rent limit",
		text: "Room rent is limited to 1% of the sum insured per day. Where the rent is higher, other charges reduce in the same ratio.",
	},
	"6.1": {
		id: "6.1",
		title: "Co-payment",
		text: "A policyholder aged 61 or over pays 20% of every admissible claim.",
	},
	"5.3": {
		id: "5.3",
		title: "Items the policy does not pay",
		text: "Gloves, masks, gowns and other consumables listed in Annexure 1 are not payable.",
	},
	"3.1": {
		id: "3.1",
		title: "Waiting period",
		text: "An illness that begins in the first 30 days of the policy is not covered. Accidents are covered from the first day.",
	},
};

// Sample checklist text written for this project, in our own words.
/** Pre-Flight clauses cited by the Pre-Flight fixture. Ids overlap Claim Check's. */
export const preFlightClauseFixtures: Readonly<Record<string, Clause>> = {
	"1.1": {
		id: "1.1",
		title: "Public repository",
		text: "The repository is public, so anyone can read the source.",
	},
	"1.2": {
		id: "1.2",
		title: "Open-source licence",
		text: "A licence file sits at the root, where GitHub can detect it.",
	},
	"2.2": {
		id: "2.2",
		title: "Kiro directory",
		text: "The .kiro directory is committed and is not listed in .gitignore.",
	},
	"4.1": {
		id: "4.1",
		title: "Demo video",
		text: "The demo video runs for less than 3 minutes.",
	},
};

/** Definitions for every fact the fixtures ask about or list, all five types. */
export const factDefFixtures: Readonly<Record<string, FactDef>> = {
	room_rent_per_day: {
		type: "money",
		ask: "What was the room rent per day?",
		why: "The policy caps room rent, and a higher rent reduces other charges too.",
	},
	sum_insured: { type: "money", ask: "What is the sum insured on the policy?" },
	age: { type: "number", ask: "How old is the patient?" },
	stay_days: { type: "number", ask: "How many days was the hospital stay?" },
	room_type: {
		type: "enum",
		ask: "Which room did the patient stay in?",
		options: [
			"general_ward",
			"twin_sharing",
			"semi_private",
			"private",
			"single_with_attendant",
			"deluxe",
		],
	},
	claim_route: {
		type: "enum",
		ask: "How will the claim be settled?",
		options: ["cashless", "reimbursement"],
	},
	treating_specialty: {
		type: "enum",
		ask: "Which department treated the patient?",
		options: [
			"cardiology",
			"orthopaedics",
			"neurology",
			"oncology",
			"general_surgery",
			"gastroenterology",
			"nephrology",
			"urology",
			"ophthalmology",
			"ear_nose_and_throat",
		],
	},
	admission_date: { type: "date", ask: "When was the patient admitted?" },
	is_emergency: { type: "boolean", ask: "Was it an emergency admission?" },
	is_public: { type: "boolean", role: "check", label: "Public repository" },
	has_detectable_license: {
		type: "boolean",
		role: "check",
		label: "License file GitHub can detect",
	},
	kiro_not_ignored: {
		type: "boolean",
		role: "check",
		label: ".kiro is not ignored",
	},
	video_under_3_minutes: {
		type: "boolean",
		role: "check",
		label: "Demo video under 3 minutes",
		ask: "Is the demo video under 3 minutes?",
	},
};

/** Questions keyed by fact, covering every control type. */
export const questionFixtures: Readonly<Record<string, Question>> = {
	room_rent_per_day: questionFixture,
	age: {
		kind: "question",
		fact: "age",
		text: "How old is the patient?",
		why: "A policyholder aged 61 or over pays part of every claim.",
		clause: "6.1",
	},
	stay_days: {
		kind: "question",
		fact: "stay_days",
		text: "How many days was the hospital stay?",
		why: "The room rent limit applies to each day of the stay.",
		clause: "4.2",
	},
	room_type: {
		kind: "question",
		fact: "room_type",
		text: "Which room did the patient stay in?",
		why: "The room decides the rent the policy compares with its limit.",
		clause: "4.2",
	},
	admission_date: {
		kind: "question",
		fact: "admission_date",
		text: "When was the patient admitted?",
		why: "The policy pays only for a stay that starts while it is in force.",
	},
	is_emergency: {
		kind: "question",
		fact: "is_emergency",
		text: "Was it an emergency admission?",
		why: "An emergency admission is covered from the first day of the policy.",
	},
	video_under_3_minutes: {
		kind: "question",
		fact: "video_under_3_minutes",
		text: "Is the demo video under 3 minutes?",
	},
};

/** Three answers as the rail shows them, in the order they were given. */
export const answersFixture: readonly AnswerEntry[] = [
	{
		fact: "room_rent_per_day",
		label: "Room rent per day",
		display: "₹6,000",
		value: 6_000_00,
	},
	{
		fact: "sum_insured",
		label: "Sum insured",
		display: "₹5,00,000",
		value: 500_000_00,
	},
	{ fact: "age", label: "Age", display: "64", value: 64 },
];

/** A question that stopped mattering, with the line the app writes for it. */
export const skippedFixture: readonly SkippedNote[] = [
	{
		fact: "pre_existing_condition",
		label: "Pre-existing condition",
		reason:
			"Pre-existing condition no longer matters. The answers so far decide this without it.",
	},
];

/** Every charge admitted: nothing is deducted. */
export const paidInFullVerdictFixture: Verdict = {
	kind: "verdict",
	goals: { payable_amount: CLAIMED_AMOUNT, verdict: "paid" },
	lineItems: [],
	needed: [],
};

/** One deduction takes the whole claim. */
export const deniedVerdictFixture: Verdict = {
	kind: "verdict",
	goals: { payable_amount: 0, verdict: "denied" },
	lineItems: [
		{
			fact: "waiting_period_deduction",
			role: "deduction",
			label: "Illness began in the waiting period",
			value: CLAIMED_AMOUNT,
			rule: "WAIT-01",
			clause: "3.1",
		},
	],
	needed: [],
};

/** No goal is decided yet: two questions still matter, and no line has a value. */
export const undecidedVerdictFixture: Verdict = {
	kind: "verdict",
	goals: { payable_amount: undefined, verdict: undefined },
	lineItems: [
		{
			fact: "room_rent_deduction",
			role: "deduction",
			label: "Room rent above the limit",
			value: undefined,
			rule: "ROOM-03",
			clause: "4.2",
		},
	],
	needed: [questionFixture, questionFixtures.age as Question],
};

const CONSUMABLES = [
	"Gloves",
	"Face masks",
	"Surgical gowns",
	"Disposable caps",
	"Shoe covers",
	"Cotton wool",
	"Adhesive tape",
	"Thermometer",
	"Nebuliser kit",
	"Spacer",
] as const;

/** Thirty deductions of ₹1,000 each, for long ledgers. */
export const manyDeductionsFixture: Verdict = {
	kind: "verdict",
	goals: { payable_amount: CLAIMED_AMOUNT - 30 * 1_000_00, verdict: "reduced" },
	lineItems: Array.from({ length: 30 }, (_, i) => ({
		fact: `consumable_${i + 1}_deduction`,
		role: "deduction" as const,
		label: `${CONSUMABLES[i % CONSUMABLES.length]}, ward ${Math.floor(i / CONSUMABLES.length) + 1}`,
		value: 1_000_00,
		rule: `CONS-${String(i + 1).padStart(2, "0")}`,
		clause: "5.3",
	})),
	needed: [],
};

/**
 * Deliberately NOT engine-faithful. One deduction is not known yet, yet payable
 * is known: a real engine would leave payable unknown too. It exists only to
 * show the Ledger's "Not known yet" row, since `LedgerProps.payable.value` is a
 * number. fixtures.test.ts exempts it from the arithmetic check by name.
 */
export const unknownLineWithKnownPayableFixture: Verdict = {
	kind: "verdict",
	goals: { payable_amount: 172_000_00, verdict: "reduced" },
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
			value: undefined,
			rule: "COPAY-01",
			clause: "6.1",
		},
	],
	needed: [],
};

/** A deduction that worked out to nothing: the ledger leaves it out. */
export const zeroDeductionFixture: Verdict = {
	kind: "verdict",
	goals: { payable_amount: 172_000_00, verdict: "reduced" },
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
			value: 0,
			rule: "COPAY-01",
			clause: "6.1",
		},
	],
	needed: [],
};

/** Every check passes. */
export const preFlightAllPassFixture: Verdict = {
	kind: "verdict",
	goals: { verdict: "ready" },
	lineItems: preFlightVerdictFixture.lineItems.map((item) => ({
		...item,
		value: true,
	})),
	needed: [],
};

/** The collector could not see two facts; one of them is asked. */
export const preFlightUnknownFixture: Verdict = {
	kind: "verdict",
	goals: { verdict: undefined },
	lineItems: preFlightVerdictFixture.lineItems.map((item) =>
		item.fact === "is_public" ? item : { ...item, value: undefined },
	),
	needed: preFlightVerdictFixture.needed,
};

const [ROOM_RENT_LINE, COPAY_LINE] = claimVerdictFixture.lineItems;

/** One-answer changes to the claim verdict, each removing one deduction. */
export const alternativesFixture: readonly Alternative[] = [
	{
		fact: "room_rent_per_day",
		value: 5_000_00,
		verdict: {
			kind: "verdict",
			goals: { payable_amount: 180_500_00, verdict: "reduced" },
			lineItems: COPAY_LINE ? [COPAY_LINE] : [],
			needed: [],
		},
	},
	{
		fact: "age",
		value: 60,
		verdict: {
			kind: "verdict",
			goals: { payable_amount: 172_000_00, verdict: "reduced" },
			lineItems: ROOM_RENT_LINE ? [ROOM_RENT_LINE] : [],
			needed: [],
		},
	},
];

/** One-answer changes to the all-pass Pre-Flight verdict: no money goal. */
export const alternativesNoMoneyFixture: readonly Alternative[] = [
	"is_public",
	"has_detectable_license",
].map((fact) => ({
	fact,
	value: false,
	verdict: {
		...preFlightAllPassFixture,
		goals: { verdict: "not_ready" },
		lineItems: preFlightAllPassFixture.lineItems.map((item) =>
			item.fact === fact ? { ...item, value: false } : item,
		),
	},
}));

/** Pre-Flight: a failed check whose facts the collector read from GitHub. */
export const collectedProofFixture: ProofNode = {
	fact: "has_detectable_license",
	value: false,
	source: "derived",
	rule: "R-02",
	clause: "1.2",
	because: "No licence file sits at the root of the repository.",
	children: [
		{
			fact: "root_files",
			value: "README.md, package.json, .gitignore",
			source: "collected",
			children: [],
		},
		{
			fact: "license_spdx",
			value: "NOASSERTION",
			source: "collected",
			children: [],
		},
	],
};

/** A deduction that cannot be worked out yet: the age is not answered. */
export const unknownValueProofFixture: ProofNode = {
	fact: "copay_deduction",
	value: undefined,
	source: "derived",
	rule: "COPAY-01",
	clause: "6.1",
	because: "A co-payment of 20% applies at age 61 or over.",
	children: [
		{ fact: "age", value: undefined, source: "answered", children: [] },
		{
			fact: "admissible_amount",
			value: 147_500_00,
			source: "derived",
			rule: "PAY-02",
			because:
				"The admissible amount is the claim less the room rent deduction.",
			children: [],
		},
	],
};
