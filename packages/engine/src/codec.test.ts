import { describe, expect, it } from "vitest";
import { decode, encode, start } from "./api";
import { base64urlEncode } from "./codec/base64url";
import { ByteWriter, utf8Encode } from "./codec/bytes";
import { sha256 } from "./codec/sha256";
import { EngineError, type ErrorCode } from "./errors";
import { parse } from "./lang/parse";
import type { Expr, FactDef, FactValue, KnowledgeBase, Session } from "./types";

function expr(src: string): Expr {
	const r = parse(src);
	if (!r.ok) throw new Error(`parse failed: ${r.error.message}`);
	return r.expr;
}

// Sorted fact names: amount(0) covered(1) dob(2) plan(3) ratio(4) total(5).
const kb: KnowledgeBase = {
	id: "codec-kb",
	currency: "USD",
	goals: ["total"],
	facts: {
		amount: { type: "money", ask: "Amount?" },
		covered: { type: "boolean", ask: "Covered?" },
		dob: { type: "date", ask: "Birth date?" },
		plan: { type: "enum", options: ["basic", "gold", "plus"], ask: "Plan?" },
		ratio: { type: "number", ask: "Ratio?" },
		total: { type: "money", derived: true },
	},
	rules: [
		{
			id: "r-total",
			cite: "c-total",
			set: "total",
			to: expr("amount"),
			because: "because",
		},
	],
	clauses: {},
};

const FULL: Session = {
	kb,
	answers: {
		amount: -250000,
		covered: false,
		dob: "1990-02-28",
		plan: "gold",
		ratio: 0.125,
	},
};

/** Fingerprint exactly as the token layout documents it. */
function fingerprintOf(k: KnowledgeBase): Uint8Array {
	return sha256(utf8Encode(JSON.stringify(k))).slice(0, 16);
}

/** Builds a token by hand: version, fingerprint, then the payload writer. */
function craft(
	payload: (w: ByteWriter) => void,
	opts: { version?: number; kb?: KnowledgeBase } = {},
): string {
	const w = new ByteWriter();
	w.byte(opts.version ?? 1).raw(fingerprintOf(opts.kb ?? kb));
	payload(w);
	return base64urlEncode(w.toBytes());
}

function codeOf(fn: () => unknown): { code: ErrorCode; message: string } {
	try {
		fn();
	} catch (e) {
		if (e instanceof EngineError) return { code: e.code, message: e.message };
		throw e;
	}
	throw new Error("expected an EngineError, nothing was thrown");
}

describe("encode and decode round trips", () => {
	it("round-trips an answer of every fact type", () => {
		const token = encode(FULL);
		expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
		const back = decode(kb, token);
		expect(back.kb).toBe(kb);
		expect(back.answers).toEqual(FULL.answers);
		expect(encode(back)).toBe(token);
	});

	it("round-trips true, zero money, large money and a leap day", () => {
		const cases: Record<string, FactValue>[] = [
			{ covered: true },
			{ amount: 0 },
			{ amount: Number.MAX_SAFE_INTEGER },
			{ amount: Number.MIN_SAFE_INTEGER + 1 },
			{ dob: "2024-02-29" },
			{ dob: "0001-01-01" },
			{ dob: "9999-12-31" },
			{ ratio: -1.5e-300 },
		];
		for (const answers of cases) {
			const s: Session = { kb, answers };
			expect(decode(kb, encode(s)).answers).toEqual(answers);
		}
	});

	it("round-trips an empty session", () => {
		const s = start(kb);
		const token = encode(s);
		expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
		const back = decode(kb, token);
		expect(back.answers).toEqual({});
		expect(back.kb).toBe(kb);
	});

	it("gives the same token whatever order answers were added in", () => {
		const reversed: Session = {
			kb,
			answers: Object.fromEntries(Object.entries(FULL.answers).reverse()),
		};
		expect(encode(reversed)).toBe(encode(FULL));
	});

	it("stores negative zero as zero", () => {
		const s: Session = { kb, answers: { ratio: -0, amount: -0 } };
		const back = decode(kb, encode(s));
		expect(Object.is(back.answers.ratio, 0)).toBe(true);
		expect(Object.is(back.answers.amount, 0)).toBe(true);
	});
});

describe("size bound", () => {
	it("keeps 64 answers of 64-character names and values within 2048 characters", () => {
		const facts: Record<string, FactDef> = {};
		const answers: Record<string, string> = {};
		const value = "v".repeat(64);
		for (let i = 0; i < 64; i++) {
			const name = `${String(i).padStart(2, "0")}${"f".repeat(62)}`;
			facts[name] = { type: "enum", options: [value, "other"], ask: "?" };
			answers[name] = value;
		}
		const big: KnowledgeBase = {
			id: "big",
			currency: "USD",
			goals: [],
			facts,
			rules: [],
			clauses: {},
		};
		const token = encode({ kb: big, answers });
		expect(token.length).toBeLessThanOrEqual(2048);
		expect(decode(big, token).answers).toEqual(answers);
	});
});

describe("fingerprint", () => {
	it("is stable for deep-equal knowledge bases and changes with a rule", () => {
		const copy: KnowledgeBase = JSON.parse(JSON.stringify(kb));
		// JSON loses nothing the codec reads, but Expr objects may hold undefined keys.
		expect(encode({ kb: copy, answers: {} })).toBe(encode(start(kb)));
		const changed: KnowledgeBase = {
			...kb,
			rules: [
				{
					...(kb.rules[0] as KnowledgeBase["rules"][number]),
					to: expr("amount + 1"),
				},
			],
		};
		expect(encode({ kb: changed, answers: {} })).not.toBe(encode(start(kb)));
	});
});

describe("one example per error code", () => {
	it("MALFORMED_TOKEN: empty string", () => {
		expect(codeOf(() => decode(kb, "")).code).toBe("MALFORMED_TOKEN");
	});

	it("MALFORMED_TOKEN: character outside the alphabet", () => {
		const token = encode(FULL);
		expect(codeOf(() => decode(kb, `${token}=`)).code).toBe("MALFORMED_TOKEN");
		expect(codeOf(() => decode(kb, `+${token.slice(1)}`)).code).toBe(
			"MALFORMED_TOKEN",
		);
	});

	it("MALFORMED_TOKEN: truncated, trailing bytes, bad tag, repeated fact", () => {
		const token = encode(FULL);
		expect(codeOf(() => decode(kb, token.slice(0, 10))).code).toBe(
			"MALFORMED_TOKEN",
		);
		expect(codeOf(() => decode(kb, token.slice(0, -4))).code).toBe(
			"MALFORMED_TOKEN",
		);
		const trailing = craft((w) => w.varint(0).byte(99));
		expect(codeOf(() => decode(kb, trailing)).code).toBe("MALFORMED_TOKEN");
		const trail2 = craft((w) => w.varint(0).byte(0).byte(0));
		expect(codeOf(() => decode(kb, trail2)).code).toBe("MALFORMED_TOKEN");
		const repeat = craft((w) =>
			w.varint(2).varint(1).byte(1).varint(1).byte(0),
		);
		const err = codeOf(() => decode(kb, repeat));
		expect(err.code).toBe("MALFORMED_TOKEN");
		expect(err.message).toContain("covered");
	});

	it("UNSUPPORTED_VERSION: names the version found", () => {
		const token = craft((w) => w.varint(0), { version: 7 });
		const err = codeOf(() => decode(kb, token));
		expect(err.code).toBe("UNSUPPORTED_VERSION");
		expect(err.message).toContain("7");
	});

	it("KB_MISMATCH: message says the rules have changed", () => {
		const token = encode(FULL);
		const changed: KnowledgeBase = {
			...kb,
			clauses: {
				x: { title: "t", text: "t" },
			} as unknown as KnowledgeBase["clauses"],
		};
		const err = codeOf(() => decode(changed, token));
		expect(err.code).toBe("KB_MISMATCH");
		expect(err.message.toLowerCase()).toContain("rules have changed");
	});

	it("KB_MISMATCH: a token for an old rule is rejected by the new rule", () => {
		const token = encode(start(kb));
		const edited: KnowledgeBase = {
			...kb,
			rules: [
				{
					...(kb.rules[0] as KnowledgeBase["rules"][number]),
					because: "other",
				},
			],
		};
		expect(codeOf(() => decode(edited, token)).code).toBe("KB_MISMATCH");
	});

	it("UNKNOWN_FACT: index beyond the fact list", () => {
		const token = craft((w) => w.varint(1).varint(9).byte(1));
		expect(codeOf(() => decode(kb, token)).code).toBe("UNKNOWN_FACT");
	});

	it("NOT_ANSWERABLE: answer for a derived fact", () => {
		const token = craft((w) => w.varint(1).varint(5).byte(3).byte(0).varint(5));
		const err = codeOf(() => decode(kb, token));
		expect(err.code).toBe("NOT_ANSWERABLE");
		expect(err.message).toContain("total");
	});

	it("INVALID_ANSWER: wrong tag, bad enum index, bad date", () => {
		const wrongTag = craft((w) => w.varint(1).varint(0).byte(1));
		const e1 = codeOf(() => decode(kb, wrongTag));
		expect(e1.code).toBe("INVALID_ANSWER");
		expect(e1.message).toContain("amount");
		const badEnum = craft((w) => w.varint(1).varint(3).byte(5).varint(3));
		expect(codeOf(() => decode(kb, badEnum)).code).toBe("INVALID_ANSWER");
		const badDate = craft((w) =>
			w.varint(1).varint(2).byte(4).varint(4_000_000),
		);
		expect(codeOf(() => decode(kb, badDate)).code).toBe("INVALID_ANSWER");
	});

	it("INVALID_KB and CYCLE: a token for a broken knowledge base", () => {
		const bad: KnowledgeBase = { ...kb, goals: ["missing"] };
		expect(codeOf(() => encode(start(bad))).code).toBe("INVALID_KB");
		const token = craft((w) => w.varint(0), { kb: bad });
		expect(codeOf(() => decode(bad, token)).code).toBe("INVALID_KB");
		const cyc: KnowledgeBase = {
			...kb,
			rules: [
				{
					id: "r1",
					cite: "c",
					set: "total",
					to: expr("total"),
					because: "b",
				},
			],
		};
		expect(codeOf(() => encode(start(cyc))).code).toBe("CYCLE");
	});

	it("encode throws the Requirement 3 codes and returns no token", () => {
		const bad = (answers: Record<string, unknown>): Session =>
			({ kb, answers }) as Session;
		expect(codeOf(() => encode(bad({ nope: 1 }))).code).toBe("UNKNOWN_FACT");
		expect(codeOf(() => encode(bad({ total: 1 }))).code).toBe("NOT_ANSWERABLE");
		expect(codeOf(() => encode(bad({ amount: 1.5 }))).code).toBe(
			"INVALID_ANSWER",
		);
		expect(codeOf(() => encode(bad({ ratio: Number.NaN }))).code).toBe(
			"INVALID_ANSWER",
		);
		expect(codeOf(() => encode(bad({ plan: "silver" }))).code).toBe(
			"INVALID_ANSWER",
		);
	});
});

describe("fault priority (Requirement 11, criterion 10)", () => {
	const wrongFp: KnowledgeBase = { ...kb, id: "other-kb" };

	it("MALFORMED_TOKEN beats UNSUPPORTED_VERSION", () => {
		const token = `${craft((w) => w.varint(0), { version: 9 })}!`;
		expect(codeOf(() => decode(kb, token)).code).toBe("MALFORMED_TOKEN");
	});

	it("MALFORMED_TOKEN beats KB_MISMATCH", () => {
		// Wrong fingerprint and a payload with trailing bytes.
		const token = craft((w) => w.varint(0).byte(1), { kb: wrongFp });
		expect(codeOf(() => decode(kb, token)).code).toBe("MALFORMED_TOKEN");
		// Wrong fingerprint and a repeated fact.
		const repeat = craft(
			(w) => w.varint(2).varint(1).byte(1).varint(1).byte(0),
			{
				kb: wrongFp,
			},
		);
		expect(codeOf(() => decode(kb, repeat)).code).toBe("MALFORMED_TOKEN");
	});

	it("UNSUPPORTED_VERSION beats KB_MISMATCH", () => {
		const token = craft((w) => w.varint(0), { version: 2, kb: wrongFp });
		expect(codeOf(() => decode(kb, token)).code).toBe("UNSUPPORTED_VERSION");
	});

	it("KB_MISMATCH beats every answer error", () => {
		for (const payload of [
			(w: ByteWriter) => w.varint(1).varint(9).byte(1), // unknown fact
			(w: ByteWriter) => w.varint(1).varint(5).byte(3).byte(0).varint(5), // derived
			(w: ByteWriter) => w.varint(1).varint(0).byte(1), // wrong type
		]) {
			const token = craft(payload, { kb: wrongFp });
			expect(codeOf(() => decode(kb, token)).code).toBe("KB_MISMATCH");
		}
	});

	it("reports answer errors in the order of the sorted fact names", () => {
		// amount (index 0) has the wrong type; covered (index 1) is fine;
		// total (index 5) is derived. The first by name is amount.
		const token = craft((w) =>
			w
				.varint(3)
				.varint(0)
				.byte(1)
				.varint(1)
				.byte(1)
				.varint(5)
				.byte(3)
				.byte(0)
				.varint(5),
		);
		const err = codeOf(() => decode(kb, token));
		expect(err.code).toBe("INVALID_ANSWER");
		expect(err.message).toContain("amount");
	});

	it("reports a bad value on an earlier fact before an unknown fact index", () => {
		const token = craft((w) => w.varint(2).varint(0).byte(1).varint(9).byte(1));
		const err = codeOf(() => decode(kb, token));
		expect(err.code).toBe("INVALID_ANSWER");
		expect(err.message).toContain("amount");
	});

	it("reports the earlier of two bad facts by name", () => {
		// amount wrong type (index 0), plan bad enum index (index 3).
		const token = craft((w) =>
			w.varint(2).varint(0).byte(1).varint(3).byte(5).varint(9),
		);
		expect(codeOf(() => decode(kb, token)).message).toContain("amount");
		// covered wrong type (index 1), plan bad enum index (index 3).
		const t2 = craft((w) =>
			w
				.varint(2)
				.varint(1)
				.byte(2)
				.byte(0)
				.byte(0)
				.byte(0)
				.byte(0)
				.byte(0)
				.byte(0)
				.byte(0)
				.byte(0)
				.varint(3)
				.byte(5)
				.varint(9),
		);
		expect(codeOf(() => decode(kb, t2)).message).toContain("covered");
	});
});
