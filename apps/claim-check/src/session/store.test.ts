import { answer, encode, next, start } from "@dead-certain/engine";
import { describe, expect, it } from "vitest";
import { realKb } from "../testing/realKb";
import { toyKb } from "../testing/toyKb";
import { init, REJECTED, reducer, step, type ViewState } from "./store";

const kb = realKb();
const begun = reducer(init(kb, "#/"), { type: "start" });
const play = (view: ViewState, answers: Record<string, unknown>) =>
	Object.entries(answers).reduce(
		(v, [fact, value]) =>
			reducer(v, { type: "answer", fact, value: value as never }),
		view,
	);
const DENIED = {
	claimed: 100_000_00,
	cause: "accident",
	treatment: "cosmetic",
};

describe("the session reducer", () => {
	it("starts on the start screen and moves to the first question", () => {
		expect(step(init(kb, "#/")).kind).toBe("start");
		const s = step(begun);
		expect(s.kind === "question" && s.question.fact).toBe("claimed");
	});

	it("clears a replay failure on start", () => {
		const stale = init(kb, "#/?r=garbage");
		expect(step(stale)).toEqual({ kind: "stale", failure: "MALFORMED_TOKEN" });
		const started = reducer(stale, { type: "start" });
		expect(started.failure).toBeNull();
		expect(step(started).kind).toBe("question");
	});

	it("sets arrivedByAnswer only when an answer reaches a verdict", () => {
		const one = play(begun, { claimed: 100_000_00 });
		expect(one.arrivedByAnswer).toBe(false);
		const done = play(begun, DENIED);
		expect(step(done).kind).toBe("verdict");
		expect(done.arrivedByAnswer).toBe(true);
	});

	it("opens a replay link at its verdict without arrivedByAnswer", () => {
		const s = Object.entries(DENIED).reduce(
			(acc, [f, v]) => answer(acc, f, v),
			start(kb),
		);
		const view = init(kb, `#/?r=${encode(s)}`);
		expect(step(view).kind).toBe("verdict");
		expect(view.arrivedByAnswer).toBe(false);
	});

	it("keeps the session and shows a message when the engine refuses an answer", () => {
		const refused = reducer(begun, {
			type: "answer",
			fact: "cause",
			value: "flood",
		});
		expect(refused.session).toBe(begun.session);
		expect(refused.rejected).toBe(REJECTED);
	});

	it("edits an answered fact with its value filled in", () => {
		const view = reducer(play(begun, DENIED), { type: "edit", fact: "cause" });
		const s = step(view);
		expect(
			s.kind === "question" && [s.question.fact, s.value, s.editing],
		).toEqual(["cause", "accident", true]);
	});

	it("goes back to the previous fact of the path", () => {
		const view = play(begun, { claimed: 100_000_00, cause: "accident" });
		const back = reducer(view, { type: "back" });
		expect(back.editing).toBe("cause");
		expect(reducer(back, { type: "back" }).editing).toBe("claimed");
		const first = reducer(reducer(back, { type: "back" }), { type: "back" });
		expect(first.editing).toBe("claimed");
		expect(Object.keys(first.session.answers).sort()).toEqual([
			"cause",
			"claimed",
		]);
	});

	it("clears answers and skipped notes on restart", () => {
		const restarted = reducer(play(begun, DENIED), { type: "restart" });
		expect(restarted.session.answers).toEqual({});
		expect(restarted.skipped).toEqual([]);
		expect(step(restarted).kind).toBe("start");
	});

	it("closes the proof when an answer removes its target", () => {
		const done = play(begun, DENIED);
		const verdict = next(done.session);
		expect(verdict.kind).toBe("verdict");
		const opened = reducer(done, { type: "open", target: { kind: "verdict" } });
		expect(opened.open).toEqual({ kind: "verdict" });
		const changed = reducer(opened, {
			type: "answer",
			fact: "treatment",
			value: "other",
		});
		expect(step(changed).kind).toBe("question");
		expect(changed.open).toBeNull();
	});

	it("keeps skipped notes from the toy knowledge base", () => {
		const toy = toyKb();
		const view = play(reducer(init(toy, "#/"), { type: "start" }), {
			covered: true,
			amount: 40,
		});
		const changed = reducer(view, {
			type: "answer",
			fact: "covered",
			value: false,
		});
		expect(changed.skipped.map((n) => n.fact)).toEqual(["amount"]);
	});
});
