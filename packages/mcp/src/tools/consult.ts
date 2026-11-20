import {
	answer,
	decode,
	encode,
	type FactValue,
	type KnowledgeBase,
	next,
	type Question,
	type Session,
	start,
	type Verdict,
} from "@dead-certain/engine";
import { parseSessionArgs, type SessionArgs } from "../args";
import { guard } from "../guard";
import { compile } from "../kbs";
import { type JsonObject, ok, type ToolResult } from "../payload";
import type { Workspace } from "../workspace";

/** Code-unit order, so the result never depends on the engine's own sorting. */
function sortedEntries(
	record: Readonly<Record<string, FactValue>>,
): [string, FactValue][] {
	return Object.entries(record).sort(([a], [b]) =>
		a < b ? -1 : a > b ? 1 : 0,
	);
}

/**
 * The token's session first, then each explicit answer in sorted key order, so
 * an answer replaces the token's value for the same fact.
 */
export function buildSession(
	kb: KnowledgeBase,
	answers: Readonly<Record<string, FactValue>>,
	token?: string,
): Session {
	let session = token === undefined ? start(kb) : decode(kb, token);
	for (const [fact, value] of sortedEntries(answers)) {
		session = answer(session, fact, value);
	}
	return session;
}

/** Answers as JSON, in key order. */
export function answersJson(session: Session): JsonObject {
	return Object.fromEntries(sortedEntries(session.answers));
}

/** A Question in the shape of requirement 3.4. */
export function questionOut(kb: KnowledgeBase, q: Question): JsonObject {
	const def = kb.facts[q.fact];
	return {
		fact: q.fact,
		text: q.text,
		...(q.why === undefined ? {} : { why: q.why }),
		...(q.clause === undefined ? {} : { clause: q.clause }),
		type: def?.type ?? "string",
		...(def?.options === undefined ? {} : { options: [...def.options] }),
	};
}

function verdictPayload(
	kb: KnowledgeBase,
	session: Session,
	v: Verdict,
): JsonObject {
	return {
		status: "verdict",
		goals: Object.fromEntries(
			kb.goals.map((goal) => [goal, v.goals[goal] ?? null]),
		),
		line_items: v.lineItems.map((item) => ({
			fact: item.fact,
			label: item.label,
			role: item.role,
			value: item.value ?? null,
			rule: item.rule,
			clause: item.clause,
		})),
		needed: v.needed.map((q) => questionOut(kb, q)),
		answers: answersJson(session),
		token: encode(session),
	};
}

export type Opened =
	| {
			readonly ok: true;
			readonly kb: KnowledgeBase;
			readonly session: Session;
	  }
	| { readonly ok: false; readonly error: ToolResult };

/** Validate the arguments, compile the knowledge base and build the session. */
export function openSession(ws: Workspace, args: unknown): Opened {
	const parsed = parseSessionArgs(args);
	if (!parsed.ok) return parsed;
	const input: SessionArgs = parsed.value;
	const compiled = compile(ws, input.kb);
	if (!compiled.ok) return compiled;
	return {
		ok: true,
		kb: compiled.kb,
		session: buildSession(compiled.kb, input.answers, input.token),
	};
}

/** `consult`: the next question, or the verdict, for these answers. */
export function consult(ws: Workspace, args: unknown): ToolResult {
	return guard(() => {
		const opened = openSession(ws, args);
		if (!opened.ok) return opened.error;
		const { kb, session } = opened;
		const outcome = next(session);
		if (outcome.kind === "question") {
			return ok({
				status: "question",
				question: questionOut(kb, outcome),
				answers: answersJson(session),
				token: encode(session),
			});
		}
		return ok(verdictPayload(kb, session, outcome));
	});
}
