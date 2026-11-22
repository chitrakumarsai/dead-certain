import { explain, type ProofNode } from "@dead-certain/engine";
import { describe, expect, it } from "vitest";
import { HERO_FACTS, STEP_FACT, STEP_RULE } from "./hero/config";
import { steps } from "./stepsData";
import { claimKb } from "./testing/claimKb";

const kb = claimKb();
const nodes = (n: ProofNode): ProofNode[] => [n, ...n.children.flatMap(nodes)];

describe("the step rule (requirement 4.3)", () => {
	it("exists, is in the room rent row's proof, and reads on a phone", () => {
		const data = steps(kb, STEP_RULE);
		expect(data).not.toBeNull();
		const proof = nodes(explain({ kb, answers: HERO_FACTS }, STEP_FACT));
		expect(proof.map((n) => n.rule)).toContain(STEP_RULE);
		expect(data?.rule.expression.length).toBeLessThanOrEqual(90);
	});

	it("quotes the knowledge base's own text (requirement 8.3)", () => {
		const rule = kb.rules.find((r) => r.id === STEP_RULE);
		const data = steps(kb, STEP_RULE);
		expect(data?.rule.because).toBe(rule?.because);
		expect(data?.clause).toEqual(kb.clauses[rule?.cite ?? ""]);
	});
});

describe("steps fall back to no data", () => {
	it("when the rule is missing", () => {
		expect(steps(kb, "NO-SUCH-RULE")).toBeNull();
	});

	it("when the rule's clause is missing", () => {
		const rule = kb.rules.find((r) => r.id === STEP_RULE);
		const { [rule?.cite ?? ""]: _, ...clauses } = kb.clauses;
		expect(steps({ ...kb, clauses }, STEP_RULE)).toBeNull();
	});
});
