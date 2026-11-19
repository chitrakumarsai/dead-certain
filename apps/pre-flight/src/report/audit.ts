import {
	audit,
	explain,
	type FactValue,
	type KnowledgeBase,
	type LineItem,
	type ProofNode,
	type Question,
	type Verdict,
} from "@dead-certain/engine";
import type { Derived } from "../../collectors/derive";
import type { RepoSnapshot } from "../../collectors/types";
import { type Checklist, GOAL, type Severity } from "../checklists";
import { evidenceFor } from "./evidence";
import { placeQuestions } from "./questions";
import { relabelSources } from "./sources";
import { type Summary, summarize } from "./summary";

export interface CheckView {
	severity: Severity;
	item: LineItem;
	proof: ProofNode;
	/** Evidence lines joined with a line break; "" when no collected fact is in the proof. */
	evidence: string;
	/** The inline question, for an unknown check whose proof needs a boolean answer. */
	question?: Question;
}

export interface ReportView {
	verdict: Verdict;
	/** owner/name, as parsed from the user's text. */
	repo: string;
	facts: Record<string, FactValue>;
	summary: Summary;
	groups: { title: string; checks: CheckView[] }[];
	/** Needed questions that no row owns or that are not boolean, under "Needs your answer". */
	listQuestions: Question[];
}

/** The report for one snapshot and the user's answers (design: "The audit"). */
export function buildReport(input: {
	kb: KnowledgeBase;
	checklist: Checklist;
	snapshot: RepoSnapshot;
	derived: Derived;
	answers: Readonly<Record<string, FactValue>>;
}): ReportView {
	const { kb, checklist, snapshot, derived } = input;
	// Collected values win over answers (6.9).
	const facts = { ...input.answers, ...derived.facts };
	const verdict = audit(kb, facts);
	const collected = new Set(Object.keys(derived.facts));
	const rows = checklist.groups.map((g) => ({
		title: g.title,
		checks: g.checks.map((spec) => {
			// A check missing from lineItems is caught at start-up; it shows as unknown.
			const item: LineItem = verdict.lineItems.find(
				(i) => i.fact === spec.fact,
			) ?? {
				fact: spec.fact,
				role: "check",
				label: spec.fact,
				value: undefined,
				rule: "",
				clause: "",
			};
			const proof = relabelSources(
				explain({ kb, answers: facts }, spec.fact),
				collected,
			);
			return {
				severity: spec.severity,
				item,
				proof,
				evidence: evidenceFor(proof, derived.evidence),
			};
		}),
	}));
	const all = rows.flatMap((g) => g.checks);
	const unknown = all
		.filter((c) => c.item.value === undefined)
		.map((c) => ({ fact: c.item.fact, proof: c.proof }));
	const { inline, list } = placeQuestions(kb, unknown, verdict.needed);
	const groups = rows.map((g) => ({
		title: g.title,
		checks: g.checks.map((c): CheckView => {
			const q = inline.get(c.item.fact);
			return q === undefined ? c : { ...c, question: q };
		}),
	}));
	const repo = `${snapshot.target.owner}/${snapshot.target.name}`;
	const summary = summarize(
		verdict.goals[GOAL],
		all.map((c) => ({ severity: c.severity, value: c.item.value })),
		verdict.needed.length,
		repo,
	);
	return { verdict, repo, facts, summary, groups, listQuestions: list };
}
