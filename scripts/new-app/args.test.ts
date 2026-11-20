import { describe, expect, it } from "vitest";
import { parseArgs } from "./args.ts";

describe("parseArgs", () => {
	it("reads a name, with or without --dry-run in either place (1.4)", () => {
		expect(parseArgs(["loan-check"])).toEqual({
			ok: true,
			name: "loan-check",
			dryRun: false,
		});
		expect(parseArgs(["--dry-run", "loan-check"])).toEqual({
			ok: true,
			name: "loan-check",
			dryRun: true,
		});
		expect(parseArgs(["loan-check", "--dry-run"])).toEqual({
			ok: true,
			name: "loan-check",
			dryRun: true,
		});
	});

	it.each([
		["no name", []],
		["only the option", ["--dry-run"]],
		["two names", ["a-app", "b-app"]],
		["an unknown option", ["loan-check", "--force"]],
		["a short option", ["loan-check", "-f"]],
	])("is a usage error with %s (1.5)", (_, argv) => {
		expect(parseArgs(argv as string[])).toEqual({ ok: false, usage: true });
	});
});
