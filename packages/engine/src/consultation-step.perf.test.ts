import { describe, expect, it } from "vitest";
import { answer, next, start } from "./api";
import { parse } from "./lang/parse";
import type {
	Expr,
	FactDef,
	FactValue,
	KnowledgeBase,
	Rule,
	Session,
} from "./types";

const MEDIAN_LIMIT_MS = 10;
// The tail limit applies to the 99th percentile, not the single slowest sample.
// One slow sample (a GC pause, or a machine still busy after a browser run)
// is noise; the 10 ms median above is the real requirement and stays strict.
const TAIL_LIMIT_MS = 50;
const WARM_UPS = 20;
const MEASURED = 200;

function expr(src: string): Expr {
	const r = parse(src);
	if (!r.ok) throw new Error(`parse failed for "${src}": ${r.error.message}`);
	return r.expr;
}

/**
 * Builds the Benchmark_KB: 36 askable facts, 33 derived facts (69 facts),
 * 108 rules and 3 goals. Rules use guards, `if`, `min`, `max`, `round` and
 * `days_between`. Layers only depend on earlier layers, so there is no cycle.
 */
function buildBenchmarkKb(): {
	kb: KnowledgeBase;
	askable: { name: string; value: FactValue }[];
} {
	const facts: Record<string, FactDef> = {};
	const rules: Rule[] = [];
	const askable: { name: string; value: FactValue }[] = [];

	const addAskable = (name: string, def: FactDef, value: FactValue): void => {
		facts[name] = { ...def, ask: `Question about ${name}?` };
		askable.push({ name, value });
	};
	const addRule = (set: string, to: string, when?: string): void => {
		const n = rules.length;
		rules.push({
			id: `r${n}`,
			cite: `c${n % 10}`,
			set,
			to: expr(to),
			...(when === undefined ? {} : { when: expr(when) }),
			because: `Rule ${n} applies to {${set}}.`,
		});
	};

	// Askable facts: 12 boolean, 12 money, 6 number, 6 date.
	for (let i = 0; i < 12; i++) {
		addAskable(`b${i}`, { type: "boolean" }, i % 3 !== 0);
		addAskable(`m${i}`, { type: "money" }, 5000 + i * 1300);
	}
	for (let i = 0; i < 6; i++) {
		addAskable(`n${i}`, { type: "number" }, i + 1);
		addAskable(`d${i}`, { type: "date" }, `2024-0${i + 1}-1${i + 1}`);
	}

	// Layer 1: money facts c0..c11 (3 rules each = 36), days facts dd0..dd5 (2 each = 12).
	for (let i = 0; i < 12; i++) {
		facts[`c${i}`] = { type: "money", derived: true };
		addRule(`c${i}`, `min(m${i}, m${(i + 1) % 12})`, `b${i}`);
		addRule(`c${i}`, `max(m${i} - 50, 0)`, `not b${i} and m${i} > 100`);
		addRule(`c${i}`, `if(b${i}, m${i}, 0)`);
	}
	for (let k = 0; k < 6; k++) {
		facts[`dd${k}`] = { type: "number", derived: true, role: "check" };
		addRule(
			`dd${k}`,
			`days_between(d${k}, d${(k + 1) % 6})`,
			`n${k} > 3 or b${k}`,
		);
		addRule(`dd${k}`, "0");
	}

	// Layer 2: money facts e0..e11 (3 rules each = 36).
	for (let j = 0; j < 12; j++) {
		facts[`e${j}`] = { type: "money", derived: true, role: "deduction" };
		addRule(
			`e${j}`,
			`c${j} + c${(j + 1) % 12}`,
			`c${j} > 0 and dd${j % 6} < 300`,
		);
		addRule(`e${j}`, `round(c${j} / 2)`, `b${j} or b${(j + 1) % 12}`);
		addRule(`e${j}`, "0");
	}

	// Layer 3: three goals, 8 rules each = 24.
	const goals: string[] = [];
	for (let g = 0; g < 3; g++) {
		const goal = `g${g}`;
		goals.push(goal);
		facts[goal] = { type: "money", derived: true };
		for (let j = 0; j < 7; j++) {
			addRule(
				goal,
				`max(e${(g + j) % 12} - c${j}, 0)`,
				`b${j} and e${(g + j) % 12} > ${j * 10}`,
			);
		}
		addRule(goal, "0");
	}

	return {
		kb: { id: "benchmark", currency: "USD", goals, facts, rules, clauses: {} },
		askable,
	};
}

function percentile(sorted: readonly number[], p: number): number {
	const idx = Math.min(sorted.length - 1, Math.ceil(p * sorted.length) - 1);
	return sorted[Math.max(0, idx)] as number;
}

/** One Consultation_Step: an `answer`, then `next` on the result. */
function step(s: Session, fact: string, value: FactValue): void {
	next(answer(s, fact, value));
}

describe("consultation step performance", () => {
	it("keeps one answer-then-next step under the median and 99th-percentile limits", () => {
		const { kb, askable } = buildBenchmarkKb();

		// Shape of the Benchmark_KB.
		const factCount = Object.keys(kb.facts).length;
		expect(factCount).toBeGreaterThanOrEqual(50);
		expect(kb.rules.length).toBeGreaterThanOrEqual(100);
		expect(kb.goals.length).toBeGreaterThanOrEqual(3);

		// Answer exactly half (rounded down) of the askable facts, every other one.
		const half = Math.floor(askable.length / 2);
		let session = start(kb);
		for (let i = 0; i < half; i++) {
			const a = askable[i * 2] as { name: string; value: FactValue };
			session = answer(session, a.name, a.value);
		}
		expect(Object.keys(session.answers)).toHaveLength(half);

		// Each step re-answers an already answered fact with its same value.
		const answered = Object.entries(session.answers);
		const pick = (i: number): [string, FactValue] =>
			answered[i % answered.length] as [string, FactValue];

		for (let i = 0; i < WARM_UPS; i++) {
			const [fact, value] = pick(i);
			step(session, fact, value);
		}

		const durations: number[] = [];
		for (let i = 0; i < MEASURED; i++) {
			const [fact, value] = pick(i);
			const t0 = performance.now();
			step(session, fact, value);
			durations.push(performance.now() - t0);
		}

		const sorted = [...durations].sort((a, b) => a - b);
		const mid = sorted.length / 2;
		const median =
			sorted.length % 2 === 0
				? ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2
				: (sorted[Math.floor(mid)] as number);
		const p95 = percentile(sorted, 0.95);
		const p99 = percentile(sorted, 0.99);
		const max = sorted[sorted.length - 1] as number;

		console.log(
			`consultation step (${durations.length} steps, ${factCount} facts, ${kb.rules.length} rules): ` +
				`median ${median.toFixed(3)} ms, p95 ${p95.toFixed(3)} ms, p99 ${p99.toFixed(3)} ms, max ${max.toFixed(3)} ms`,
		);

		expect(
			median < MEDIAN_LIMIT_MS,
			`median ${median.toFixed(3)} ms is not under the ${MEDIAN_LIMIT_MS} ms limit`,
		).toBe(true);
		expect(
			p99 < TAIL_LIMIT_MS,
			`99th percentile ${p99.toFixed(3)} ms is not under the ${TAIL_LIMIT_MS} ms limit`,
		).toBe(true);
	});
});
