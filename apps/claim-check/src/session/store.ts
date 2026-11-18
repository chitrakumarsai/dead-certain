import {
	answer,
	type Expr,
	type FactDef,
	type FactValue,
	type KnowledgeBase,
	next,
	type Question,
	type Session,
	start,
	type Verdict,
} from "@dead-certain/engine";
import type { ReplayFailure, SkippedNote, XrayTarget } from "@dead-certain/ui";
import { useEffect, useReducer } from "react";
import { questionPath } from "./path";
import { updateSkipped } from "./relevance";
import { decodeFragment, writeFragment } from "./replay";

export interface ViewState {
	session: Session;
	/** False on the start screen, before "Start the check". */
	started: boolean;
	/** The fact being changed, or null when the engine's next step is shown. */
	editing: string | null;
	open: XrayTarget | null;
	/** True after an answer got the user to a verdict in this visit. */
	arrivedByAnswer: boolean;
	failure: ReplayFailure | null;
	skipped: readonly SkippedNote[];
	/** The engine refused the last answer; shown under the field. */
	rejected: string | null;
	/** The fact whose earlier answer the last answer changed, for the live region. */
	changed: string | null;
}

export type Action =
	| { type: "start" }
	| { type: "answer"; fact: string; value: FactValue }
	| { type: "edit"; fact: string }
	| { type: "back" }
	| { type: "open"; target: XrayTarget }
	| { type: "close" }
	| { type: "restart" }
	| { type: "fragment"; hash: string };

export type Step =
	| { kind: "start" }
	| { kind: "stale"; failure: ReplayFailure }
	| {
			kind: "question";
			question: Question;
			def: FactDef;
			value: FactValue | undefined;
			editing: boolean;
	  }
	| { kind: "verdict"; verdict: Verdict };

export const REJECTED =
	"This answer could not be used. Check it and try again.";

const fresh = (kb: KnowledgeBase, started: boolean): ViewState => ({
	session: start(kb),
	started,
	editing: null,
	open: null,
	arrivedByAnswer: false,
	failure: null,
	skipped: [],
	rejected: null,
	changed: null,
});

/** The state a fragment opens: a decoded session, a failure, or the start screen. */
export function init(kb: KnowledgeBase, hash: string): ViewState {
	const decoded = decodeFragment(kb, hash);
	if (decoded === null) return fresh(kb, false);
	if (!decoded.ok) return { ...fresh(kb, false), failure: decoded.failure };
	return { ...fresh(kb, true), session: decoded.session };
}

/** The open proof closes when its line or goal is gone after an answer (8.12). */
function keepOpen(
	open: XrayTarget | null,
	step: Question | Verdict,
): XrayTarget | null {
	if (open === null || step.kind !== "verdict") return null;
	if (open.kind === "verdict") return open;
	return step.lineItems.some((item) => item.fact === open.fact) ? open : null;
}

function currentFact(view: ViewState): string | undefined {
	if (view.editing !== null) return view.editing;
	const step = next(view.session);
	return step.kind === "question" ? step.fact : undefined;
}

export function reducer(view: ViewState, action: Action): ViewState {
	const kb = view.session.kb;
	switch (action.type) {
		case "start":
			return fresh(kb, true);
		case "restart":
			return fresh(kb, false);
		case "answer": {
			let session: Session;
			try {
				session = answer(view.session, action.fact, action.value);
			} catch {
				return { ...view, rejected: REJECTED };
			}
			const step = next(session);
			const before = view.session.answers[action.fact];
			return {
				...view,
				session,
				changed:
					before !== undefined && before !== action.value ? action.fact : null,
				editing: null,
				rejected: null,
				open: keepOpen(view.open, step),
				arrivedByAnswer: step.kind === "verdict",
				skipped: updateSkipped(
					view.skipped,
					view.session,
					session,
					action.fact,
				),
			};
		}
		case "edit":
			return {
				...view,
				editing: action.fact,
				open: null,
				arrivedByAnswer: false,
				rejected: null,
			};
		case "back": {
			const path = questionPath(kb, view.session.answers);
			const at = path.indexOf(currentFact(view) ?? "");
			const previous = at > 0 ? path[at - 1] : undefined;
			if (previous === undefined) return view;
			return {
				...view,
				editing: previous,
				arrivedByAnswer: false,
				rejected: null,
			};
		}
		case "open":
			return { ...view, open: action.target };
		case "close":
			return { ...view, open: null };
		case "fragment":
			return init(kb, action.hash);
	}
}

function usesFact(expr: Expr | undefined, fact: string): boolean {
	if (expr === undefined) return false;
	switch (expr.kind) {
		case "literal":
			return false;
		case "fact":
			return expr.name === fact;
		case "unary":
			return usesFact(expr.operand, fact);
		case "binary":
			return usesFact(expr.left, fact) || usesFact(expr.right, fact);
		case "call":
			return expr.args.some((arg) => usesFact(arg, fact));
	}
}

/** A question for a fact the user chose to change, from its definition. */
export function questionFor(kb: KnowledgeBase, fact: string): Question | null {
	const def = kb.facts[fact];
	if (def?.ask === undefined) return null;
	const rule = kb.rules.find(
		(r) => usesFact(r.to, fact) || usesFact(r.when, fact),
	);
	return {
		kind: "question",
		fact,
		text: def.ask,
		...(def.why === undefined ? {} : { why: def.why }),
		...(rule === undefined ? {} : { clause: rule.cite }),
	};
}

/** What the check page shows. */
export function step(view: ViewState): Step {
	if (view.failure !== null) return { kind: "stale", failure: view.failure };
	if (!view.started) return { kind: "start" };
	const { kb, answers } = view.session;
	const engineStep = next(view.session);
	const fact =
		view.editing ?? (engineStep.kind === "question" ? engineStep.fact : null);
	if (fact === null) return { kind: "verdict", verdict: engineStep as Verdict };
	const question =
		engineStep.kind === "question" && engineStep.fact === fact
			? engineStep
			: questionFor(kb, fact);
	const def = kb.facts[fact];
	if (question === null || def === undefined)
		return { kind: "verdict", verdict: engineStep as Verdict };
	return {
		kind: "question",
		question,
		def,
		value: answers[fact],
		editing: view.editing !== null,
	};
}

/**
 * The store, with the fragment kept in step: written after every session
 * change on the check route, and read again when the user changes it.
 */
export function useSession(kb: KnowledgeBase, onCheckRoute: boolean) {
	const [view, dispatch] = useReducer(reducer, kb, (k) =>
		init(k, location.hash),
	);
	useEffect(() => {
		if (onCheckRoute) writeFragment(view.session);
	}, [view.session, onCheckRoute]);
	useEffect(() => {
		if (!onCheckRoute) return;
		const onHash = () => dispatch({ type: "fragment", hash: location.hash });
		window.addEventListener("hashchange", onHash);
		return () => window.removeEventListener("hashchange", onHash);
	}, [onCheckRoute]);
	return [view, dispatch] as const;
}
