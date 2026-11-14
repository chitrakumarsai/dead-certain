import {
	Button,
	Ledger,
	ProofTree,
	Sheet,
	XrayStage,
	type XrayTarget,
} from "@dead-certain/ui";
import {
	CLAIMED_AMOUNT,
	claimVerdictFixture,
	deepProofFixture,
	proofFixture,
	unknownValueProofFixture,
} from "@dead-certain/ui/fixtures";
import { useId, useState } from "react";
import {
	clauseFor,
	labelFor,
	ruleExpression,
	valueFor,
} from "./ProofTreeSection";
import { Specimen } from "./Specimen";

const format = { currency: "INR" } as const;
const PROOFS = {
	room_rent_deduction: proofFixture,
	copay_deduction: unknownValueProofFixture,
};
const lineLabel = (fact: string) =>
	claimVerdictFixture.lineItems.find((item) => item.fact === fact)?.label ??
	fact;
const title = (target: XrayTarget) =>
	target.kind === "verdict" ? "Why" : `Why: ${lineLabel(target.fact)}`;
const keyOf = (target: XrayTarget) =>
	target.kind === "verdict" ? "verdict" : target.fact;

/** A small stand-in for the verdict sheet: a heading, the ledger and See why. */
function Stage({
	heading,
	vanishing = false,
}: {
	heading: string;
	vanishing?: boolean;
}) {
	const [target, setTarget] = useState<XrayTarget | null>(null);
	const headingId = useId();
	const close = () => setTarget(null);
	const openButton = vanishing ? (
		target === null && (
			<Button onClick={() => setTarget({ kind: "verdict" })}>
				See why, then go
			</Button>
		)
	) : (
		<Button onClick={() => setTarget({ kind: "verdict" })}>See why</Button>
	);

	return (
		<XrayStage
			target={target}
			title={title}
			onClose={close}
			sheet={
				<Sheet as="section" aria-labelledby={headingId}>
					<h2 id={headingId} className="font-doc text-question font-semibold">
						{heading}
					</h2>
					<div className="pt-4">
						<Ledger
							claimed={{ label: "Claimed", value: CLAIMED_AMOUNT }}
							items={claimVerdictFixture.lineItems}
							payable={{
								label: "Payable",
								value: Number(claimVerdictFixture.goals.payable_amount),
							}}
							format={format}
							selectedFact={target?.kind === "line" ? target.fact : undefined}
							onOpen={(item) => setTarget({ kind: "line", fact: item.fact })}
						/>
					</div>
					<div className="pt-4">{openButton}</div>
				</Sheet>
			}
			film={(open) => (
				<ProofTree
					// A new target starts its tree fresh.
					key={keyOf(open)}
					root={
						open.kind === "verdict"
							? deepProofFixture
							: (PROOFS[open.fact as keyof typeof PROOFS] ?? proofFixture)
					}
					labelFor={labelFor}
					formatValue={valueFor}
					clauseFor={clauseFor}
					ruleExpression={ruleExpression}
					decidingClause="1.2"
					onEscape={close}
				/>
			)}
		/>
	);
}

export const XRAY_STAGE_SPECIMENS = [
	{ id: "xraystage-closed", title: "Closed, then open" },
	{ id: "xraystage-vanishing", title: "Opener removed" },
];

export function XrayStageSection() {
	return (
		<section aria-labelledby="xraystage-heading" className="pt-16">
			<h2
				id="xraystage-heading"
				className="font-doc text-verdict font-semibold"
			>
				XrayStage
			</h2>
			<p className="max-w-column pt-2 text-text-soft">
				The verdict on paper and its proof on film. From 1280 px the film opens
				beside the sheet; below that it rises as a bottom sheet. The first open
				develops it behind a scan line; with reduced motion it fades in.
			</p>

			<Specimen
				id="xraystage-closed"
				title="Closed, then open"
				note="See why opens the whole verdict; a ledger row opens its line. Another row swaps the proof at once. Close or Escape returns focus to the opener."
			>
				<Stage heading="Claim verdict" />
			</Specimen>
			<Specimen
				id="xraystage-vanishing"
				title="Opener removed"
				note="The button that opened the film is gone by the time it closes, so focus lands on the sheet heading."
			>
				<Stage heading="Claim verdict, opener goes" vanishing />
			</Specimen>
		</section>
	);
}
