import { audit } from "@dead-certain/engine";
import { describe, expect, it } from "vitest";
import { deriveFacts } from "../../collectors/derive";
import { kb } from "../kb";
import { loadSample, SAMPLES } from "../run/samples";

const RUNS = 101;

/** The median time of `fn` over RUNS calls, so one slow sample cannot fail the test. */
function median(fn: () => void): number {
	const times: number[] = [];
	for (let i = 0; i < RUNS; i++) {
		const t = performance.now();
		fn();
		times.push(performance.now() - t);
	}
	return times.sort((a, b) => a - b)[RUNS >> 1] ?? Infinity;
}

// One audit over a snapshot's facts takes under 10 ms (11.9).
describe("audit over the built knowledge base", () => {
	it("takes under 10 ms for each bundled sample", async () => {
		if (kb === null) throw new Error("kb/dist/checklist.json did not load");
		for (const s of SAMPLES) {
			const snapshot = await loadSample(s.id);
			if (snapshot === undefined) throw new Error(s.id);
			const facts = deriveFacts(snapshot, kb).facts;
			const k = kb;
			expect(
				median(() => audit(k, facts)),
				s.id,
			).toBeLessThan(10);
		}
	});
});
