import type {
	FactValue,
	KnowledgeBase,
	LineItem,
	Question,
} from "@dead-certain/engine";
import {
	AnswerControl,
	Button,
	CheckRow,
	Sheet,
	useAnnounce,
	VerdictHeadline,
} from "@dead-certain/ui";
import { type FormEvent, useEffect, useId, useRef, useState } from "react";
import type { ReportView } from "../report/audit";

const time = (iso: string) =>
	new Intl.DateTimeFormat(undefined, {
		hour: "2-digit",
		minute: "2-digit",
	}).format(new Date(iso));
export const dateOf = (iso: string) =>
	new Intl.DateTimeFormat(undefined, {
		day: "numeric",
		month: "long",
		year: "numeric",
	}).format(new Date(iso));

/** A needed question that is not yes/no, under "Needs your answer" (6.4). */
function ListQuestion({
	kb,
	question,
	value,
	onAnswer,
}: {
	kb: KnowledgeBase;
	question: Question;
	value: FactValue | undefined;
	onAnswer: (fact: string, value: FactValue) => void;
}) {
	const id = useId();
	const def = kb.facts[question.fact];
	const [draft, setDraft] = useState<FactValue | undefined>(value);
	const [problem, setProblem] = useState<string | undefined>();
	const [shown, setShown] = useState<string | undefined>();
	if (def === undefined) return null;
	const submit = (event?: FormEvent) => {
		event?.preventDefault();
		if (draft === undefined) setShown(problem ?? "Enter an answer.");
		else onAnswer(question.fact, draft);
	};
	return (
		<li className="py-3">
			<form onSubmit={submit} className="flex flex-col gap-2">
				<p id={id} className="text-sys-body">
					{question.text}
				</p>
				<AnswerControl
					fact={question.fact}
					def={def}
					value={draft}
					onChange={(next, why) => {
						setDraft(next);
						setProblem(why);
						setShown(undefined);
					}}
					onEnter={() => submit()}
					{...(shown === undefined ? {} : { error: shown })}
					labelledBy={id}
					format={{}}
				/>
				<div>
					<Button type="submit">Save answer</Button>
				</div>
			</form>
		</li>
	);
}

export function Report({
	kb,
	view,
	answers,
	origin,
	takenAt,
	reopened,
	onAnswer,
	onOpen,
}: {
	kb: KnowledgeBase;
	view: ReportView;
	answers: Readonly<Record<string, FactValue>>;
	origin: "live" | "snapshot";
	takenAt: string;
	reopened?: string;
	onAnswer: (fact: string, value: FactValue) => void;
	onOpen: (item: LineItem, opener: HTMLElement) => void;
}) {
	// The headline announces itself when its state changes; a new sentence under
	// the same state ("2 warnings" to "1 warning") is announced here (6.3).
	const announce = useAnnounce();
	const first = useRef(true);
	const sentence = view.summary.sentence;
	useEffect(() => {
		if (first.current) first.current = false;
		else announce(sentence);
	}, [announce, sentence]);

	// A reopened answer is asked again in its row (6.5); a row asks only while unknown otherwise.
	const reopenedQuestion = (fact: string): Question | undefined => {
		const def = kb.facts[fact];
		return def?.ask === undefined
			? undefined
			: { kind: "question", fact, text: def.ask };
	};
	const holds = (
		proof: ReportView["groups"][0]["checks"][0]["proof"],
		fact: string,
	): boolean =>
		proof.fact === fact || proof.children.some((c) => holds(c, fact));
	const reopenedBoolean =
		reopened !== undefined && kb.facts[reopened]?.type === "boolean";
	const listQuestions = [...view.listQuestions];
	if (
		reopened !== undefined &&
		!reopenedBoolean &&
		!listQuestions.some((q) => q.fact === reopened)
	) {
		const q = reopenedQuestion(reopened);
		if (q) listQuestions.unshift(q);
	}

	return (
		<Sheet as="article" aria-labelledby="summary">
			{origin === "snapshot" && (
				<p className="pb-4 text-sys-body">{`Using a snapshot of ${view.repo} taken ${dateOf(takenAt)}.`}</p>
			)}
			<div id="summary">
				<VerdictHeadline
					state={view.summary.state}
					statement={sentence}
					size="summary"
				/>
			</div>
			<p className="pt-2 text-sys-small text-text-soft">
				{origin === "snapshot"
					? `Snapshot taken ${dateOf(takenAt)}`
					: `Checked ${time(takenAt)}`}
			</p>
			{view.groups.map((group) => (
				<section
					key={group.title}
					data-report-group
					aria-labelledby={`group-${group.title}`}
					className="pt-6"
				>
					<h2
						id={`group-${group.title}`}
						className="text-sys-body font-semibold"
					>
						{group.title}
					</h2>
					<ul className="divide-y divide-divider">
						{group.checks.map((check) => {
							const again =
								reopenedBoolean &&
								reopened !== undefined &&
								holds(check.proof, reopened)
									? reopenedQuestion(reopened)
									: undefined;
							const question = again ?? check.question;
							const def =
								question === undefined ? undefined : kb.facts[question.fact];
							// CheckRow asks only for an unknown row; a reopened answer shows its row as unknown.
							const item =
								again === undefined
									? check.item
									: { ...check.item, value: undefined };
							return (
								<CheckRow
									key={check.item.fact}
									item={item}
									{...(check.evidence === "" ? {} : { detail: check.evidence })}
									{...(question === undefined ? {} : { question })}
									{...(def === undefined ? {} : { def })}
									{...(question !== undefined &&
									answers[question.fact] !== undefined
										? { answerValue: answers[question.fact] }
										: {})}
									onAnswer={onAnswer}
									onOpen={onOpen}
									format={{}}
								/>
							);
						})}
					</ul>
				</section>
			))}
			{listQuestions.length > 0 && (
				<section aria-labelledby="needs-heading" className="pt-6">
					<h2 id="needs-heading" className="text-sys-body font-semibold">
						Needs your answer
					</h2>
					<ul>
						{listQuestions.map((q) => (
							<ListQuestion
								key={q.fact}
								kb={kb}
								question={q}
								value={answers[q.fact]}
								onAnswer={onAnswer}
							/>
						))}
					</ul>
				</section>
			)}
			<div className="pt-8" data-print-hide>
				<Button variant="quiet" onClick={() => (location.hash = "#/")}>
					Check another repository
				</Button>
			</div>
		</Sheet>
	);
}
