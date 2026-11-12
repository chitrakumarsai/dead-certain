import { describe, expect, it } from "vitest";
import { EngineError } from "./errors";
import { buildVerdict, evaluateSession } from "./outcome";
import type { FactDef, KnowledgeBase } from "./types";
import { clip, deepEqual, deriveLabel } from "./util";

describe("deriveLabel", () => {
	it("turns underscores into spaces and capitalises the first letter", () => {
		expect(deriveLabel("room_rent_excess")).toBe("Room rent excess");
	});

	it("keeps the rest unchanged and handles edge shapes", () => {
		expect(deriveLabel("aBc_DEF")).toBe("ABc DEF");
		expect(deriveLabel("a__b")).toBe("A  b");
		expect(deriveLabel("")).toBe("");
		expect(deriveLabel("_x")).toBe(" x");
	});

	it("upper-cases a whole leading code point", () => {
		expect(deriveLabel("\u{10428}x")).toBe("\u{10400}x");
	});
});

/** A one-fact knowledge base whose only line item is `name` with the given def. */
function verdictFor(name: string, def: FactDef) {
	const kb: KnowledgeBase = {
		id: "labels",
		goals: [name],
		facts: { [name]: def },
		rules: [],
		clauses: {},
	};
	return buildVerdict(kb, evaluateSession(kb, {}));
}

describe("label precedence (through buildVerdict)", () => {
	it("derives a label when FactDef.label is absent", () => {
		const v = verdictFor("room_rent_excess", {
			type: "money",
			derived: true,
			role: "deduction",
		});
		expect(v.lineItems[0]?.label).toBe("Room rent excess");
	});

	it("prefers FactDef.label over the derived label", () => {
		const v = verdictFor("room_rent_excess", {
			type: "money",
			derived: true,
			role: "deduction",
			label: "Room rent cap",
		});
		expect(v.lineItems[0]?.label).toBe("Room rent cap");
	});
});

describe("EngineError", () => {
	it("survives a JSON round trip with name, code and message", () => {
		const err = new EngineError("INVALID_KB", "bad goal x");
		expect(err).toBeInstanceOf(Error);
		expect(JSON.parse(JSON.stringify(err))).toEqual({
			name: "EngineError",
			code: "INVALID_KB",
			message: "bad goal x",
		});
	});

	it("clips messages to 500 characters", () => {
		expect(new EngineError("CYCLE", "x".repeat(501)).message).toHaveLength(500);
		expect(new EngineError("CYCLE", "x".repeat(500)).message).toHaveLength(500);
		expect(new EngineError("CYCLE", "short").message).toBe("short");
	});

	it("does not leave half a surrogate pair when clipping", () => {
		const text = `${"x".repeat(499)}\u{1F600}`;
		expect(new EngineError("CYCLE", text).message).toBe("x".repeat(499));
		expect(clip("abc", 5)).toBe("abc");
	});
});

describe("deepEqual", () => {
	it("treats an undefined property as equal to an absent one", () => {
		expect(deepEqual({ a: 1, b: undefined }, { a: 1 })).toBe(true);
		expect(deepEqual({ a: 1 }, { a: 1, b: undefined })).toBe(true);
		expect(deepEqual({ a: 1 }, { a: 1, b: 0 })).toBe(false);
		expect(deepEqual({ a: undefined }, { b: 1 })).toBe(false);
	});

	it("compares nested structures and arrays", () => {
		expect(deepEqual({ a: [1, { b: undefined }] }, { a: [1, {}] })).toBe(true);
		expect(deepEqual([1, 2], [1, 2, 3])).toBe(false);
		expect(deepEqual([], {})).toBe(false);
		expect(deepEqual(null, {})).toBe(false);
	});

	it("handles NaN, signed zero and own-key names like __proto__", () => {
		expect(deepEqual(Number.NaN, Number.NaN)).toBe(true);
		expect(deepEqual(0, -0)).toBe(true);
		const a = JSON.parse('{"__proto__": 1}');
		expect(deepEqual(a, {})).toBe(false);
		expect(deepEqual(a, JSON.parse('{"__proto__": 1}'))).toBe(true);
	});
});
