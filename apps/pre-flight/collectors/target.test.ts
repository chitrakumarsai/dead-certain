import { describe, expect, it } from "vitest";
import { parseTarget } from "./target";

const OK = { ok: true, target: { owner: "kiro-dev", name: "dead.certain_2" } };
const NOT_GITHUB = { ok: false, reason: "not_github" };

describe("parseTarget", () => {
	it.each([
		"kiro-dev/dead.certain_2",
		"github.com/kiro-dev/dead.certain_2",
		"www.github.com/kiro-dev/dead.certain_2",
		"https://github.com/kiro-dev/dead.certain_2",
		"http://github.com/kiro-dev/dead.certain_2",
		"https://github.com/kiro-dev/dead.certain_2/",
		"https://github.com/kiro-dev/dead.certain_2.git",
		"kiro-dev/dead.certain_2.git",
		"https://github.com/kiro-dev/dead.certain_2/tree/main/src",
		"https://github.com/kiro-dev/dead.certain_2?tab=readme-ov-file#install",
		"  https://github.com/kiro-dev/dead.certain_2  ",
		"\tkiro-dev/dead.certain_2\n",
	])("reads %j as kiro-dev/dead.certain_2 (2.3)", (input) => {
		expect(parseTarget(input)).toEqual(OK);
	});

	it.each(["", "   ", "\n\t"])("calls %j empty (2.5)", (input) => {
		expect(parseTarget(input)).toEqual({ ok: false, reason: "empty" });
	});

	it("accepts the longest owner and name, and one-character ones (2.4)", () => {
		const owner = `a${"b".repeat(37)}c`;
		const name = "n".repeat(100);
		expect(parseTarget(`${owner}/${name}`)).toEqual({
			ok: true,
			target: { owner, name },
		});
		expect(parseTarget("a/b")).toEqual({
			ok: true,
			target: { owner: "a", name: "b" },
		});
	});

	it.each([
		["an owner of 40 characters", `${"a".repeat(40)}/name`],
		["an owner starting with a hyphen", "-owner/name"],
		["an owner ending with a hyphen", "owner-/name"],
		["an owner with an underscore", "own_er/name"],
		["an owner with a dot", "own.er/name"],
		["a name of 101 characters", `owner/${"n".repeat(101)}`],
		["the name .", "owner/."],
		["the name ..", "owner/.."],
		["a name that is only .git", "owner/.git"],
		["a name with a space", "owner/na me"],
		["a name with a percent sign", "owner/na%2fme"],
		["no slash", "owner"],
		["three segments without a host", "owner/name/extra"],
		["an empty owner", "/name"],
		["an empty name", "owner/"],
		["a backslash", "owner\\name"],
		["a control character", "owner/na\u0000me"],
		["non-ASCII letters", "öwner/name"],
	])("rejects %s (2.4, 2.6)", (_, input) => {
		expect(parseTarget(input)).toEqual(NOT_GITHUB);
	});

	it.each([
		"https://github.com.evil.example/owner/name",
		"github.com.evil.example/owner/name",
		"https://gist.github.com/owner/name",
		"https://github.com@evil.example/owner/name",
		"github.com@evil.example/owner/name",
		"https://user:pass@github.com/owner/name",
		"https://github.com:8080/owner/name",
		"https://github.com:443/owner/name",
		"https://evil.example/github.com/owner/name",
		"https://gitlab.com/owner/name",
		"ftp://github.com/owner/name",
		"javascript://github.com/owner/name",
		"https://github.com/owner",
		"https://github.com/",
	])("rejects the host or shape of %j (2.6, 3.6)", (input) => {
		expect(parseTarget(input)).toEqual(NOT_GITHUB);
	});

	it("keeps the case the user typed", () => {
		expect(parseTarget("Kiro-Dev/Dead-Certain")).toEqual({
			ok: true,
			target: { owner: "Kiro-Dev", name: "Dead-Certain" },
		});
	});
});
