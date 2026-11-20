import { decode } from "@dead-certain/engine";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { answersArb } from "../../kb-tools/src/testkit";
import { compile } from "./kbs";
import { GEN_REF, kbCaseArb } from "./testkit/arbs";
import { bodyOf } from "./testkit/body";
import { consult } from "./tools/consult";

describe("mcp-server token", () => {
	// Feature: mcp-server, Property 3: The Replay_Token round-trips
	// **Validates: Requirements 3.3, 8.3**
	it("decodes to the Payload's answers, replays an equal Payload, and answers win over token", () => {
		let checked = 0;
		let replayed = 0;
		fc.assert(
			fc.property(
				kbCaseArb.chain((sample) =>
					sample === undefined
						? fc.constant(undefined)
						: answersArb(sample.kb, { partial: true }).map((second) => ({
								sample,
								second,
							})),
				),
				(both) => {
					fc.pre(both !== undefined);
					if (both === undefined) return;
					const { sample, second } = both;
					checked++;
					const { ws } = sample.workspace;
					const first = consult(ws, { kb: GEN_REF, answers: sample.answers });
					if (first.isError) return;
					replayed++;
					const body = bodyOf(first);

					const compiled = compile(ws, GEN_REF);
					if (!compiled.ok) throw new Error("generated kb must compile");
					expect(decode(compiled.kb, body.token).answers).toEqual(body.answers);

					const again = consult(ws, { kb: GEN_REF, token: body.token });
					expect(again.content).toEqual(first.content);

					// answers win over token: same as one call with the merged answers.
					const merged = { ...sample.answers, ...second };
					const withToken = consult(ws, {
						kb: GEN_REF,
						token: body.token,
						answers: second,
					});
					const direct = consult(ws, { kb: GEN_REF, answers: merged });
					expect(withToken.content).toEqual(direct.content);
					if (!withToken.isError) {
						for (const [fact, value] of Object.entries(second)) {
							expect(bodyOf(withToken).answers[fact]).toEqual(value);
						}
					}
				},
			),
			{ numRuns: 120 },
		);
		expect(checked).toBeGreaterThan(100);
		expect(replayed).toBeGreaterThan(50);
	});
});
