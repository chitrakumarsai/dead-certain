// Test-only. A knowledge base where one answer decides whether another is used.
import type { KnowledgeBase } from "@dead-certain/engine";
import { compileText } from "@dead-certain/kb-tools";

const YAML = `id: toy
goals: [result]
facts:
  covered:
    type: boolean
    ask: Is it covered?
  amount:
    type: number
    ask: How much?
  result:
    type: number
    derived: true
rules:
  - id: R-1
    cite: "1"
    set: result
    when: covered
    to: amount
    because: A covered claim pays the amount.
  - id: R-2
    cite: "1"
    set: result
    when: not covered
    to: "0"
    because: A claim that is not covered pays nothing.
clauses:
  "1":
    title: Cover
    text: Covered claims pay the amount.
`;

export function toyKb(): KnowledgeBase {
	const result = compileText(YAML, "toy.yaml");
	if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
	return JSON.parse(result.json) as KnowledgeBase;
}
