import { answer, encode, next, start } from "@dead-certain/engine";
import { describe, expect, it } from "vitest";
import { plainAnswers } from "../testing/consultArb";
import { realKb } from "../testing/realKb";
import { questionPath } from "./path";
import { fragmentFor } from "./replay";
import { init, REJECTED, reducer, step, type ViewState } from "./store";

const kb = realKb();
const begun = reducer(init(kb, "#/"), { type: "start" });
const play = (view: ViewState, answers: Record<string, unknown>) =>
	Object.entries(answers).reduce(
		(v, [fact, value]) =>
			reducer(v, { type: "answer", fact, value: value as never }),
		view,
	);
const ALL = plainAnswers(kb);
const path = questionPath(kb, ALL);

describe("the session reducer", () => {
	it("starts on the start screen and moves to the first question", () => {
		expect(step(init(kb, "#/")).kind).toBe("start");
		const s = step(begun);
		expect(s.kind === "question" && s.question.fact).toBe(path[0]);
	});

	it("reaches a verdict and sets arrivedByAnswer only then", () => {
		expect(play(begun, plainAnswers(kb, 1)).arrivedByAnswer).toBe(
			path.length === 1,
		);
		const done = play(begun, ALL);
		expect(step(done).kind).toBe("verdict");
		expect(done.arrivedByAnswer).toBe(true);
	});

	it("opens a replay link at its verdict without arrivedByAnswer", () => {
		const s = Object.entries(ALL).reduce(
			(acc, [f, v]) => answer(acc, f, v),
			start(kb),
		);
		const view = init(kb, `#/?r=${encode(s)}`);
		expect(step(view).kind).toBe("verdict");
		expect(view.arrivedByAnswer).toBe(false);
	});

	it("clears a replay failure on start", () => {
		const stale = init(kb, "#/?r=garbage");
		expect(step(stale)).toEqual({ kind: "stale", failure: "MALFORMED_TOKEN" });
		const started = reducer(stale, { type: "start" });
		expect(started.failure).toBeNull();
		expect(step(started).kind).toBe("question");
	});

	it("keeps the session and shows a message when the engine refuses an answer", () => {
		const first = path[0] ?? "";
		const wrong = typeof ALL[first] === "string" ? 12345 : "not-a-value";
		const refused = reducer(begun, {
			type: "answer",
			fact: first,
			value: wrong,
		});
		expect(refused.session).toBe(begun.session);
		expect(refused.rejected).toBe(REJECTED);
	});

	it("edits an answered fact with its value filled in", () => {
		const first = path[0] ?? "";
		const view = reducer(play(begun, ALL), { type: "edit", fact: first });
		const s = step(view);
		expect(
			s.kind === "question" && [s.question.fact, s.value, s.editing],
		).toEqual([first, ALL[first], true]);
	});

	it("goes back along the path and stops at the first question", () => {
		const view = play(begun, plainAnswers(kb, 1));
		const back = reducer(view, { type: "back" });
		expect(back.editing).toBe(path[0]);
		expect(reducer(back, { type: "back" })).toBe(back);
	});

	it("keeps an open proof when the fragment returns to the same answers", () => {
		const opened = reducer(play(begun, ALL), {
			type: "open",
			target: { kind: "verdict" },
		});
		const hash = fragmentFor(opened.session);
		expect(reducer(opened, { type: "fragment", hash })).toBe(opened);
		expect(reducer(opened, { type: "fragment", hash: "#/" }).open).toBeNull();
	});

	it("clears the answers on restart", () => {
		const restarted = reducer(play(begun, ALL), { type: "restart" });
		expect(restarted.session.answers).toEqual({});
		expect(step(restarted).kind).toBe("start");
		expect(next(restarted.session).kind).toBe("question");
	});
});
