import * as engine from "@dead-certain/engine";
import { answer, encode, start } from "@dead-certain/engine";
import { afterEach, describe, expect, it, vi } from "vitest";
import { realKb } from "../testing/realKb";
import { decodeFragment, fragmentFor, readFragment } from "./replay";

vi.mock("@dead-certain/engine", { spy: true });

const kb = realKb();
const answered = answer(start(kb), "claimed", 250_000_00);

afterEach(() => vi.mocked(engine.decode).mockRestore());

describe("decodeFragment", () => {
	it("returns the session for a valid token", () => {
		const result = decodeFragment(kb, fragmentFor(answered));
		expect(result).toEqual({ ok: true, session: answered });
	});

	it("returns null when the fragment carries no token", () => {
		expect(decodeFragment(kb, "#/")).toBeNull();
		expect(decodeFragment(kb, "")).toBeNull();
		expect(decodeFragment(kb, "#/rulebook?r=abc")).toBeNull();
	});

	it("reports KB_MISMATCH for a token made with another knowledge base", () => {
		const other = { ...kb, id: "another-policy" };
		const token = encode(answer(start(other), "claimed", 100_00));
		expect(decodeFragment(kb, `#/?r=${token}`)).toEqual({
			ok: false,
			failure: "KB_MISMATCH",
		});
	});

	it("reports MALFORMED_TOKEN for garbage", () => {
		expect(decodeFragment(kb, "#/?r=not-a-token")).toEqual({
			ok: false,
			failure: "MALFORMED_TOKEN",
		});
	});

	it("reports MALFORMED_TOKEN, with no message, for a throw that is not an EngineError", () => {
		vi.mocked(engine.decode).mockImplementation(() => {
			throw new TypeError("internal detail");
		});
		const result = decodeFragment(kb, "#/?r=x");
		expect(result).toEqual({ ok: false, failure: "MALFORMED_TOKEN" });
		expect(JSON.stringify(result)).not.toContain("internal detail");
	});
});

describe("the fragment", () => {
	it("is #/ with no answers and carries the token otherwise", () => {
		expect(fragmentFor(start(kb))).toBe("#/");
		expect(readFragment(fragmentFor(answered))).toBe(encode(answered));
	});
});
