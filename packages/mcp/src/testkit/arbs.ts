// Test-only generators. Knowledge bases and answers come from kb-tools' test
// kit (which builds on the engine's); they are written to YAML with its printer
// so the server compiles them from a file, as it does for real.
import type { FactValue, KnowledgeBase } from "@dead-certain/engine";
import { compileText } from "@dead-certain/kb-tools";
import fc from "fast-check";
import { answersArb, kbArb, renderYaml } from "../../../kb-tools/src/testkit";
import { type TestWorkspace, workspaceOf } from "./workspaces";

export const GEN_REF = "gen/kb";
const GEN_FILE = "apps/gen/kb/kb.yaml";

export interface KbCase {
	readonly kb: KnowledgeBase;
	readonly text: string;
	/** Type-valid answers for some of the askable facts. */
	readonly answers: Readonly<Record<string, FactValue>>;
	readonly workspace: TestWorkspace;
}

/** A generated knowledge base that passes validation, as a one-file workspace. */
export const kbCaseArb: fc.Arbitrary<KbCase | undefined> = kbArb.chain(
	(generated) => {
		const text = renderYaml(generated);
		const compiled = compileText(text, GEN_FILE);
		if (!compiled.ok) return fc.constant(undefined);
		const kb = compiled.kb;
		return answersArb(kb, { partial: true }).map(
			(answers): KbCase => ({
				kb,
				text,
				answers,
				workspace: workspaceOf({ [GEN_REF]: text }),
			}),
		);
	},
);

/** Plain objects with the same entries in another order. */
export function permuted<T>(
	record: Readonly<Record<string, T>>,
): fc.Arbitrary<Record<string, T>> {
	const entries = Object.entries(record);
	return fc
		.shuffledSubarray(entries, {
			minLength: entries.length,
			maxLength: entries.length,
		})
		.map((shuffled) => Object.fromEntries(shuffled));
}
