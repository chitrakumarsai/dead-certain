import { describe, expect, it } from "vitest";
import { parseArgs, USAGE } from "./args";

describe("parseArgs: golden", () => {
	it("accepts golden with no path, one path and several paths", () => {
		expect(parseArgs(["golden"])).toEqual({
			kind: "run",
			command: "golden",
			paths: [],
		});
		expect(parseArgs(["golden", "apps/x"])).toEqual({
			kind: "run",
			command: "golden",
			paths: ["apps/x"],
		});
		expect(parseArgs(["golden", "apps/x/golden/a.yaml", "apps/y"])).toEqual({
			kind: "run",
			command: "golden",
			paths: ["apps/x/golden/a.yaml", "apps/y"],
		});
	});

	it.each([["--json"], ["-v"], [""]])(
		"rejects the argument %j as malformed, so --json is a usage error",
		(arg) => {
			expect(parseArgs(["golden", arg])).toEqual({
				kind: "usage",
				message: `dc: malformed argument '${arg}'.`,
			});
		},
	);

	it("still accepts validate and build, and rejects an unknown command", () => {
		expect(parseArgs(["validate"]).kind).toBe("run");
		expect(parseArgs(["build"]).kind).toBe("run");
		expect(parseArgs(["goldens"])).toEqual({
			kind: "usage",
			message: "dc: unknown command 'goldens'.",
		});
	});

	it("lists golden beside validate and build in the usage text", () => {
		const lines = USAGE.split("\n");
		const at = (word: string) =>
			lines.findIndex((line) => line.startsWith(`  dc ${word} `));

		expect(at("golden")).toBeGreaterThan(at("build"));
		expect(lines[at("golden")]).toBe(
			"  dc golden [path...]     run golden scenarios against the compiled knowledge bases",
		);
		expect(USAGE).toContain("apps/<app>/golden/<name>.yaml");
	});
});
