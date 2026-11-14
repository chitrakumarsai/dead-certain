import {
	AnswersRail,
	Button,
	formatMoney,
	humanize,
	Ledger,
	ProportionBar,
	QuestionCard,
	type QuestionCardProps,
	Sheet,
	VerdictHeadline,
	WhatIfList,
} from "@dead-certain/ui";
import {
	alternativesFixture,
	answersFixture,
	CLAIMED_AMOUNT,
	claimFormat,
	claimVerdictFixture,
	clauseFixtures,
	factDefFixtures,
	questionFixtures,
} from "@dead-certain/ui/fixtures";
import { useState } from "react";

/** Claim Check's navigation, as each screen shows it. */
export const CLAIM_NAV = [
	{ label: "Claim check", href: "#/", current: true },
	{ label: "Rulebook", href: "#/rulebook" },
	{ label: "About", href: "#/about" },
];

export const claimRail = (current?: string) => (
	<AnswersRail
		answers={answersFixture}
		current={current}
		onChange={() => undefined}
	/>
);

const money = (minor: number) =>
	formatMoney(minor, claimFormat.currency ?? "INR");

/** Screen 1: what the check does, and the way in. */
export function StartScreen() {
	return (
		<Sheet as="section" aria-labelledby="start-heading">
			<h1 id="start-heading" className="font-doc text-verdict font-semibold">
				Check a hospital claim before you file it
			</h1>
			<p className="max-w-column pt-4 text-sys-body">
				Answer a few questions. You get the amount the policy pays, each
				deduction, and the clause behind it.
			</p>
			<div className="flex flex-wrap items-center gap-4 pt-6">
				<Button variant="primary">Start the check</Button>
				<a
					href="#/rulebook"
					className="inline-flex min-h-touch items-center text-sys-body underline underline-offset-4"
				>
					Read the sample policy
				</a>
			</div>
			<p className="pt-6 text-sys-small text-text-soft">
				Uses a sample policy written for this demo. Your answers stay in your
				browser.
			</p>
		</Sheet>
	);
}

/** Screen 2: one money question, with its reason and clause. */
export function QuestionScreen() {
	const question = questionFixtures.room_rent_per_day;
	const def = factDefFixtures.room_rent_per_day;
	const [value, setValue] = useState<QuestionCardProps["value"]>(6_000_00);
	if (!question || !def) throw new Error("room rent fixtures are missing");
	return (
		<>
			<h1 className="sr-only">Check a hospital claim</h1>
			<Sheet>
				<QuestionCard
					question={question}
					def={def}
					clause={clauseFixtures["4.2"]}
					value={value}
					onChange={setValue}
					onSubmit={() => undefined}
					onBack={() => undefined}
					progress={{ index: 3, moreAtMost: 6 }}
					format={claimFormat}
				/>
			</Sheet>
		</>
	);
}

/** Screen 3: the reduced verdict with its bar, ledger and what-if list. */
export function VerdictScreen() {
	const verdict = claimVerdictFixture;
	const payable = Number(verdict.goals.payable_amount);
	return (
		<Sheet>
			<VerdictHeadline
				state="reduced"
				statement={`${money(payable)} of ${money(CLAIMED_AMOUNT)} will be paid`}
			/>
			<div className="space-y-8 pt-8">
				<ProportionBar
					total={CLAIMED_AMOUNT}
					parts={[
						{ kind: "paid", value: payable, label: "Paid" },
						...verdict.lineItems.map((item) => ({
							kind: "cut" as const,
							value: Number(item.value),
							label: item.label,
						})),
					]}
					format={claimFormat}
				/>
				<Ledger
					claimed={{ label: "Claimed", value: CLAIMED_AMOUNT }}
					items={verdict.lineItems}
					payable={{ label: "Payable", value: payable }}
					format={claimFormat}
					onOpen={() => undefined}
				/>
				<WhatIfList
					current={verdict}
					alternatives={alternativesFixture}
					labelFor={(fact) => factDefFixtures[fact]?.label ?? humanize(fact)}
					defFor={(fact) => factDefFixtures[fact]}
					amountGoal="payable_amount"
					stateGoal="verdict"
					format={claimFormat}
				/>
				<div className="flex flex-wrap items-center gap-4">
					<Button variant="primary">See why</Button>
					<Button>Copy link to this verdict</Button>
					<a
						href="#/"
						className="inline-flex min-h-touch items-center text-sys-body underline underline-offset-4"
					>
						Start over
					</a>
				</div>
			</div>
		</Sheet>
	);
}
