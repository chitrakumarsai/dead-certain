import {
	Button,
	CheckRow,
	type CheckRowProps,
	ProofTree,
	StaleLinkNotice,
	VerdictHeadline,
	XrayStage,
	type XrayTarget,
} from "@dead-certain/ui";
import {
	claimFormat,
	claimVerdictFixture,
	factDefFixtures,
	preFlightVerdictFixture,
	proofFixture,
	unknownValueProofFixture,
} from "@dead-certain/ui/fixtures";
import { useState } from "react";
import { claimRail, VerdictScreen } from "./claimScreens";
import {
	clauseFor,
	labelFor,
	ruleExpression,
	valueFor,
} from "./ProofTreeSection";

/** Pre-Flight's navigation, as its screens show it. */
export const PREFLIGHT_NAV = [
	{ label: "Check a repository", href: "#/", current: true },
	{ label: "Checklist", href: "#/checklist" },
	{ label: "About", href: "#/about" },
];

type Item = CheckRowProps["item"];

/** The app supplies the group titles, keyed by the clause id's first number. */
const GROUP_TITLES: Readonly<Record<string, string>> = {
	"1": "Repository",
	"2": "Kiro usage",
	"4": "Submission",
};

/** Evidence lines the collector would supply, by fact. */
const EVIDENCE: Readonly<Record<string, string>> = {
	has_detectable_license: "LICENSE not found at the root",
	kiro_not_ignored: ".gitignore line 12: .kiro/",
};

/** Checks grouped by the clause id's first number, groups in number order. */
export function groupByClause(
	items: readonly Item[],
	titles: Readonly<Record<string, string>>,
): { key: string; title: string; items: Item[] }[] {
	const groups = new Map<string, Item[]>();
	for (const item of items) {
		const key = item.clause.split(".")[0] ?? item.clause;
		groups.set(key, [...(groups.get(key) ?? []), item]);
	}
	return [...groups.entries()]
		.sort(([a], [b]) => Number(a) - Number(b) || a.localeCompare(b))
		.map(([key, grouped]) => ({
			key,
			title: titles[key] ?? `Clause ${key}`,
			items: grouped,
		}));
}

const PROOFS: Readonly<Record<string, typeof proofFixture>> = {
	room_rent_deduction: proofFixture,
	copay_deduction: unknownValueProofFixture,
};
const lineLabel = (fact: string) =>
	claimVerdictFixture.lineItems.find((item) => item.fact === fact)?.label ??
	fact;

/** Screen 4: the reduced verdict with the X-ray open on its room rent line. */
export function XrayScreen() {
	const [target, setTarget] = useState<XrayTarget | null>({
		kind: "line",
		fact: "room_rent_deduction",
	});
	const keyOf = (open: XrayTarget) =>
		open.kind === "verdict" ? "verdict" : open.fact;
	return (
		<XrayStage
			target={target}
			title={(open) =>
				open.kind === "verdict" ? "Why" : `Why: ${lineLabel(open.fact)}`
			}
			onClose={() => setTarget(null)}
			// In the stage, so it collapses into its disclosure while the film is beside the sheet.
			rail={claimRail("room_rent_per_day")}
			sheet={<VerdictScreen />}
			film={(open) => (
				<ProofTree
					key={keyOf(open)}
					root={
						open.kind === "line"
							? (PROOFS[open.fact] ?? proofFixture)
							: proofFixture
					}
					labelFor={labelFor}
					formatValue={valueFor}
					clauseFor={clauseFor}
					ruleExpression={ruleExpression}
					decidingClause="4.2"
					onEscape={() => setTarget(null)}
				/>
			)}
		/>
	);
}

/** Screen 5: the Pre-Flight report, not ready, with one question asked inline. */
export function PreflightScreen() {
	const verdict = preFlightVerdictFixture;
	const failed = verdict.lineItems.filter(
		(item) => item.value === false,
	).length;
	const unknown = verdict.lineItems.filter(
		(item) => typeof item.value !== "boolean",
	).length;
	const question = verdict.needed[0];
	const [answer, setAnswer] = useState<CheckRowProps["answerValue"]>();
	return (
		<div className="max-w-column space-y-8">
			<VerdictHeadline
				state="not_ready"
				size="summary"
				statement={`${failed} checks failed and ${unknown} needs your answer in owner/name`}
			/>
			{groupByClause(verdict.lineItems, GROUP_TITLES).map((group) => (
				<section
					key={group.key}
					data-group={group.key}
					aria-labelledby={`group-${group.key}`}
				>
					<h2
						id={`group-${group.key}`}
						className="border-b border-divider pb-2 text-sys-body font-semibold"
					>
						{group.title}
					</h2>
					<ul>
						{group.items.map((item) => (
							<CheckRow
								key={item.fact}
								item={item}
								detail={EVIDENCE[item.fact]}
								question={
									question && typeof item.value !== "boolean"
										? question
										: undefined
								}
								def={question ? factDefFixtures[question.fact] : undefined}
								answerValue={answer}
								onAnswer={(_, value) => setAnswer(value)}
								onOpen={() => undefined}
								format={claimFormat}
							/>
						))}
					</ul>
				</section>
			))}
			<div className="flex flex-wrap items-center justify-between gap-4">
				<Button>Copy report as Markdown</Button>
				<p className="text-sys-small text-text-soft">Checked 14:02</p>
			</div>
		</div>
	);
}

/** Screen 6: a verdict link made with older rules. */
export function StaleScreen() {
	return (
		<>
			<h1 className="sr-only">Open a verdict link</h1>
			<StaleLinkNotice
				failure="KB_MISMATCH"
				rulebookHref="#/rulebook"
				onStart={() => undefined}
			/>
		</>
	);
}
