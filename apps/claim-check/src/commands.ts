// What Claim Check's command menu offers (requirement 16.3). Pure.
import type { AnswerEntry, CommandItem } from "@dead-certain/ui";
import { MAX_COMMANDS } from "@dead-certain/ui";
import type { Action, Step } from "./session/store";

export function commandsFor({
	step,
	answers,
	dispatch,
	copy,
}: {
	step: Step["kind"];
	/** The rail's entries, in its order. */
	answers: readonly AnswerEntry[];
	dispatch: (action: Action) => void;
	copy: () => void;
}): CommandItem[] {
	const items: CommandItem[] = [];
	if (step !== "start")
		items.push({
			id: "restart",
			label: "Start over",
			group: "Actions",
			keywords: "restart new claim",
			onSelect: () => dispatch({ type: "restart" }),
		});
	if (step === "verdict")
		items.push({
			id: "copy-link",
			label: "Copy link to this verdict",
			group: "Actions",
			keywords: "share url",
			onSelect: copy,
		});
	items.push({
		id: "rulebook",
		label: "Open the rulebook",
		group: "Pages",
		keywords: "policy clauses",
		href: "#/rulebook",
	});
	for (const entry of answers)
		items.push({
			id: `answer:${entry.fact}`,
			label: `Change ${entry.label}`,
			group: "Answers",
			keywords: entry.display,
			onSelect: () => dispatch({ type: "edit", fact: entry.fact }),
		});
	return items.slice(0, MAX_COMMANDS);
}
