// Node-side helpers: the real knowledge base and engine, to drive the
// interface by question text and to know the amounts it must show.
// @ts-expect-error TS2591: no type definitions for node:fs
import { readFileSync } from "node:fs";
import {
	answer,
	encode,
	type FactValue,
	type KnowledgeBase,
	next,
	start,
	type Verdict,
} from "@dead-certain/engine";
import { compileText } from "@dead-certain/kb-tools";
import { formatMoney, humanize } from "@dead-certain/ui";
import type { Page } from "@playwright/test";
import { answerWith, questionHeading } from "./claim-check-helpers";
import { expect } from "./kit-fixtures";

const compiled = compileText(
	readFileSync(
		new URL("../apps/claim-check/kb/policy.yaml", import.meta.url),
		"utf8",
	),
	"policy.yaml",
);
if (!compiled.ok)
	throw new Error("apps/claim-check/kb/policy.yaml does not compile");
export const claimKb = JSON.parse(compiled.json) as KnowledgeBase;

export const money = (minor: number) =>
	formatMoney(minor, claimKb.currency ?? "INR");

/** The engine's verdict for a full set of answers. */
export function verdictFor(
	answers: Readonly<Record<string, FactValue>>,
): Verdict {
	const s = Object.entries(answers).reduce(
		(acc, [f, v]) => answer(acc, f, v),
		start(claimKb),
	);
	const step = next(s);
	if (step.kind !== "verdict") throw new Error(`still asks ${step.fact}`);
	return step;
}

/** What a person types or picks for a value. */
export function answerText(fact: string, value: FactValue): string {
	const def = claimKb.facts[fact];
	if (def?.type === "money" && typeof value === "number")
		return String(value / 100);
	if (def?.type === "boolean") return value ? "Yes" : "No";
	if (def?.type === "enum") return humanize(String(value));
	return String(value);
}

/** The fact a question's text asks for; fails if two facts share the text. */
export function factAsked(text: string): string {
	const facts = Object.entries(claimKb.facts).filter(([, d]) => d.ask === text);
	expect(facts.length, `facts asking "${text}"`).toBe(1);
	return facts[0]?.[0] ?? "";
}

/**
 * Answers each question the interface asks from `answers`, until a verdict.
 * Fails, naming the fact, when the app asks for a fact `answers` does not give.
 */
export async function answerInUi(
	page: Page,
	answers: Readonly<Record<string, FactValue>>,
	/** Stop, without answering, when the app asks this fact. */
	stopAt?: string,
): Promise<string[]> {
	const asked: string[] = [];
	const nextStep = page.getByRole("button", { name: /^(Continue|See why)$/ });
	for (let i = 0; i <= Object.keys(claimKb.facts).length; i++) {
		await expect(nextStep.first()).toBeVisible();
		if ((await page.getByRole("button", { name: "Continue" }).count()) === 0)
			return asked;
		const fact = factAsked((await questionHeading(page).textContent()) ?? "");
		if (fact === stopAt) return asked;
		expect(asked.at(-1), `the app asked ${fact} twice in a row`).not.toBe(fact);
		const value = answers[fact];
		expect(
			value,
			`the app asked for ${fact}, which the answers do not give`,
		).toBeDefined();
		asked.push(fact);
		await answerWith(page, answerText(fact, value as FactValue));
	}
	throw new Error("the app never reached a verdict");
}

/** Answers that end in a part payment with a co-payment and a room-rent cut. */
export const REDUCED: Record<string, FactValue> = {
	claimed: 2_00_000_00,
	cause: "accident",
	treatment: "other",
	treated_outside_india: false,
	annexure_items: 2_000_00,
	room_rent_per_day: 6_000_00,
	sum_insured: "five_lakh",
	room_days: 5,
	age: 65,
	paid_this_year: 0,
};

/** The replay token for REDUCED. */
export const reducedToken = encode(
	Object.entries(REDUCED).reduce(
		(s, [f, v]) => answer(s, f, v),
		start(claimKb),
	),
);
