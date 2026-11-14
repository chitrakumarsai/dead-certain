import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { validateText } from "./index";

const FILE = "apps/demo/kb/demo.yaml";
const POOL = ["gold", "silver", "bronze", "platinum", "basic"] as const;

/** A non-empty list of distinct options drawn from the pool. */
const optionsArb = fc.uniqueArray(fc.constantFrom(...POOL), {
	minLength: 1,
	maxLength: 4,
});
const literalArb = fc.constantFrom(...POOL);

/** A KB with enum fact `tier` (options `tierOpts`), enum `out_e` (options `outOpts`), and one rule. */
function kb(
	tierOpts: readonly string[],
	outOpts: readonly string[],
	to: string,
	when?: string,
): string {
	return [
		"id: demo",
		"goals: [payable]",
		"facts:",
		"  payable:",
		"    type: money",
		"    derived: true",
		"  ok:",
		"    type: boolean",
		"    ask: Is it ok?",
		"  tier:",
		"    type: enum",
		"    ask: Which tier?",
		`    options: [${tierOpts.join(", ")}]`,
		"  out_e:",
		"    type: enum",
		`    options: [${outOpts.join(", ")}]`,
		"    derived: true",
		"rules:",
		"  - id: R-1",
		'    cite: "4.2"',
		"    set: out_e",
		`    to: ${JSON.stringify(to)}`,
		"    because: Because.",
		...(when === undefined ? [] : [`    when: ${JSON.stringify(when)}`]),
		"clauses:",
		'  "4.2":',
		"    title: Room",
		"    text: Room rent.",
	].join("\n");
}

function enumCount(text: string): number {
	return validateText(text, FILE).diagnostics.filter(
		(d) => d.code === "ENUM_VALUE_NOT_IN_OPTIONS",
	).length;
}

describe("Property 15: Enum literals are checked against options", () => {
	// Feature: kb-tools, Property 15: Enum literals are checked against options
	// **Validates: Requirements 9.1, 9.2, 9.3, 9.4**
	it("reports a branch leaf of `to` if and only if it is not in the set fact's options", () => {
		fc.assert(
			fc.property(
				optionsArb,
				literalArb,
				fc.boolean(),
				(opts, lit, inBranch) => {
					// Every leaf is valid except the literal under test.
					const valid = opts[0] as string;
					const to = inBranch ? `if(ok, '${lit}', '${valid}')` : `'${lit}'`;
					const expected = opts.includes(lit) ? 0 : 1;
					expect(enumCount(kb(opts, opts, to))).toBe(expected);
				},
			),
			{ numRuns: 200 },
		);
	});

	it("reports a literal compared with an enum fact, on either side of == or !=, if and only if it is not in that fact's options", () => {
		fc.assert(
			fc.property(
				optionsArb,
				literalArb,
				fc.constantFrom("==", "!="),
				fc.boolean(),
				fc.boolean(),
				(opts, lit, op, litFirst, inWhen) => {
					const cmp = litFirst ? `'${lit}' ${op} tier` : `tier ${op} '${lit}'`;
					// `out_e` accepts every pool literal so only the comparison can fail.
					const all = [...POOL];
					const text = inWhen
						? kb(opts, all, "'gold'", cmp)
						: kb(opts, all, `if(${cmp}, 'gold', 'silver')`);
					expect(enumCount(text)).toBe(opts.includes(lit) ? 0 : 1);
				},
			),
			{ numRuns: 200 },
		);
	});

	it("does not check a bare `if` condition literal against the set fact's options", () => {
		fc.assert(
			fc.property(optionsArb, literalArb, (opts, lit) => {
				// The condition compares `tier` (which accepts `lit`), while `out_e`
				// accepts only `opts`; both branch leaves are valid for `out_e`.
				const tierOpts = [...new Set([...opts, lit])];
				const valid = opts[0] as string;
				const to = `if(tier == '${lit}', '${valid}', '${valid}')`;
				expect(enumCount(kb(tierOpts, opts, to))).toBe(0);
			}),
			{ numRuns: 200 },
		);
	});
});
