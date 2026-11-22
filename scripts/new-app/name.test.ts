import { describe, expect, it } from "vitest";
import { constOf, RESERVED, titleOf, validateName } from "./name.ts";

const TAKEN = ["claim-check", "pre-flight"];

describe("validateName", () => {
	it.each([
		"ab",
		"loan-check",
		"a1",
		"x2-y3",
		"abc-def-ghi",
		`a${"b".repeat(29)}`,
	])("accepts %j (2.1)", (name) => {
		expect(validateName(name, TAKEN)).toEqual({
			ok: true,
			name,
			title: titleOf(name),
			slugConst: constOf(name),
		});
	});

	it.each([
		["one character", "a"],
		["a trailing hyphen", "a-"],
		["a leading hyphen", "-a"],
		["a double hyphen", "a--b"],
		["an upper-case letter", "A"],
		["an upper-case name", "Loan"],
		["an underscore", "a_b"],
		["31 characters", `a${"b".repeat(30)}`],
		["a leading digit", "1ab"],
		["an emoji", "ab😀"],
		["a path", "../ab"],
		["a slash", "ab/cd"],
		["a space", "ab cd"],
		["the empty string", ""],
	])("refuses %s (2.1)", (_, name) => {
		expect(validateName(name, TAKEN)).toMatchObject({
			ok: false,
			code: "BAD_NAME",
		});
	});

	it.each(
		[...RESERVED].filter(
			(r) => /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(r) && r.length >= 2,
		),
	)("refuses the reserved name %j (2.2)", (name) => {
		expect(validateName(name, TAKEN)).toMatchObject({
			ok: false,
			code: "RESERVED",
		});
	});

	it("refuses 404, which is reserved and not a valid name either", () => {
		expect(validateName("404", TAKEN).ok).toBe(false);
		expect(RESERVED).toContain("404");
	});

	it("refuses a name the site already serves (2.2, 2.3)", () => {
		expect(validateName("claim-check", TAKEN)).toMatchObject({
			ok: false,
			code: "EXISTS",
		});
	});

	it("names what is wrong in its message", () => {
		const r = validateName("kit", TAKEN);
		expect(r.ok === false && r.message).toContain("kit");
	});
});

describe("titleOf and constOf (3.7)", () => {
	it("capitalise each hyphen-separated word, and upper-snake the name", () => {
		expect(titleOf("loan-check")).toBe("Loan Check");
		expect(titleOf("ab")).toBe("Ab");
		expect(constOf("loan-check")).toBe("LOAN_CHECK");
		expect(constOf("x2-y3")).toBe("X2_Y3");
	});
});
