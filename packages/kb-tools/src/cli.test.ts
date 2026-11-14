import { describe, expect, it } from "vitest";
import { compileText } from "./compile";
import { runCli } from "./index";
import { memoryHost } from "./testkit";

const SUMMARY_EMPTY = "0 files checked, 0 errors, 0 warnings";
const WORKSPACE = "packages:\n  - apps/*\n";

/** A knowledge base that validates with no diagnostics at all. */
const GOOD = [
	"id: demo",
	"goals: [payable]",
	"facts:",
	"  payable:",
	"    type: money",
	"    derived: true",
	"rules:",
	"  - id: R-PAY",
	'    cite: "4.2"',
	"    set: payable",
	'    to: "1"',
	"    because: Because.",
	"clauses:",
	'  "4.2":',
	"    title: Room",
	"    text: Room rent.",
	"",
].join("\n");

/** Valid, but a deduction with only guarded rules: one NO_FALLBACK_RULE warning. */
const WARN = [
	"id: demo",
	"goals: [payable]",
	"facts:",
	"  payable:",
	"    type: money",
	"    derived: true",
	"  a:",
	"    type: boolean",
	"    ask: Is a true?",
	"  out:",
	"    type: money",
	"    derived: true",
	"    role: deduction",
	"rules:",
	"  - id: R-PAY",
	'    cite: "4.2"',
	"    set: payable",
	'    to: "1"',
	"    because: Because.",
	"  - id: R-1",
	'    cite: "4.2"',
	"    set: out",
	'    to: "1"',
	"    because: Because.",
	'    when: "a"',
	"clauses:",
	'  "4.2":',
	"    title: Room",
	"    text: Room rent.",
	"",
].join("\n");

const BAD = "facts: [\n";

function host(
	files: Record<string, string | Uint8Array>,
	options?: Parameters<typeof memoryHost>[1],
) {
	return memoryHost(
		{
			root: "/repo",
			files: { "pnpm-workspace.yaml": WORKSPACE, ...files },
			dirs: [],
		},
		options,
	);
}

describe("sanity of the fixtures", () => {
	it("GOOD has no diagnostics and WARN has only warnings", () => {
		expect(compileText(GOOD, "x.yaml").diagnostics).toEqual([]);
		const w = compileText(WARN, "x.yaml");
		expect(w.ok).toBe(true);
		expect(w.diagnostics.map((d) => d.code)).toEqual(["NO_FALLBACK_RULE"]);
	});
});

describe("dc validate", () => {
	it("with no files prints the empty summary and exits 0", () => {
		const r = runCli(["validate"], host({}));
		expect(r).toEqual({
			exitCode: 0,
			stdout: `${SUMMARY_EMPTY}\n`,
			stderr: "",
		});
	});

	it("also prints the empty summary for build with no files", () => {
		const h = host({});
		const r = runCli(["build"], h);
		expect(r.exitCode).toBe(0);
		expect(r.stdout).toBe(`${SUMMARY_EMPTY}\n`);
		expect(h.writes).toEqual([]);
	});

	it("checks every apps/*/kb/*.yaml and ignores kb/dist and nested files", () => {
		const r = runCli(
			["validate"],
			host({
				"apps/a/kb/one.yaml": GOOD,
				"apps/b/kb/two.yaml": GOOD,
				"apps/b/kb/dist/stale.yaml": BAD,
				"apps/b/kb/sub/nested.yaml": BAD,
				"apps/b/kb/notes.md": BAD,
			}),
		);
		expect(r.exitCode).toBe(0);
		expect(r.stdout).toBe("2 files checked, 0 errors, 0 warnings\n");
	});

	it("checks only the file passed as an argument", () => {
		const r = runCli(
			["validate", "apps/a/kb/one.yaml"],
			host({ "apps/a/kb/one.yaml": GOOD, "apps/b/kb/two.yaml": BAD }),
		);
		expect(r.exitCode).toBe(0);
		expect(r.stdout).toBe("1 files checked, 0 errors, 0 warnings\n");
	});

	it("checks only the files of a directory argument", () => {
		const r = runCli(
			["validate", "apps/b"],
			host({
				"apps/a/kb/one.yaml": BAD,
				"apps/b/kb/two.yaml": GOOD,
				"apps/b/kb/three.yaml": GOOD,
			}),
		);
		expect(r.exitCode).toBe(0);
		expect(r.stdout).toBe("2 files checked, 0 errors, 0 warnings\n");
	});

	it("de-duplicates a file named twice and via its directory", () => {
		const r = runCli(
			["validate", "apps/a", "apps/a/kb/one.yaml", "apps/a/kb/one.yaml"],
			host({ "apps/a/kb/one.yaml": GOOD }),
		);
		expect(r.stdout).toBe("1 files checked, 0 errors, 0 warnings\n");
	});

	it("finds the root from a subdirectory of the repository", () => {
		const r = runCli(
			["validate"],
			host({ "apps/a/kb/one.yaml": GOOD }, { cwd: "/repo/apps/a" }),
		);
		expect(r.exitCode).toBe(0);
		expect(r.stdout).toBe("1 files checked, 0 errors, 0 warnings\n");
	});

	it("writes nothing", () => {
		const h = host({ "apps/a/kb/one.yaml": GOOD });
		runCli(["validate"], h);
		expect(h.writes).toEqual([]);
		expect(h.madeDirs).toEqual([]);
	});

	it("prints an error line and exits 1 for an invalid file", () => {
		const r = runCli(["validate"], host({ "apps/a/kb/one.yaml": BAD }));
		expect(r.exitCode).toBe(1);
		const lines = r.stdout.trimEnd().split("\n");
		expect(lines[0]).toMatch(/^apps\/a\/kb\/one\.yaml: error YAML_SYNTAX /);
		expect(lines.at(-1)).toMatch(/^1 files checked, 1 errors, 0 warnings$/);
	});
});

describe("warnings", () => {
	it("give exit 0 and are printed with the [id] when set", () => {
		const r = runCli(["validate"], host({ "apps/a/kb/w.yaml": WARN }));
		expect(r.exitCode).toBe(0);
		const lines = r.stdout.trimEnd().split("\n");
		expect(lines[0]).toMatch(
			/^apps\/a\/kb\/w\.yaml: warning NO_FALLBACK_RULE \[out\] /,
		);
		expect(lines[1]).toBe("1 files checked, 0 errors, 1 warnings");
	});

	it("still write output on build", () => {
		const h = host({ "apps/a/kb/w.yaml": WARN });
		const r = runCli(["build"], h);
		expect(r.exitCode).toBe(0);
		expect(h.writes).toEqual(["/repo/apps/a/kb/dist/w.json"]);
	});
});

describe("dc build", () => {
	it("writes apps/<app>/kb/dist/<stem>.json for each file", () => {
		const h = host({
			"apps/a/kb/one.yaml": GOOD,
			"apps/a/kb/two.yaml": GOOD,
			"apps/b/kb/three.yaml": GOOD,
		});
		const r = runCli(["build"], h);
		expect(r.exitCode).toBe(0);
		expect(r.stderr).toBe("");
		expect(r.stdout).toBe("3 files checked, 0 errors, 0 warnings\n");
		expect([...h.writes].sort()).toEqual([
			"/repo/apps/a/kb/dist/one.json",
			"/repo/apps/a/kb/dist/two.json",
			"/repo/apps/b/kb/dist/three.json",
		]);
		expect(h.madeDirs).toContain("/repo/apps/a/kb/dist");
		const expected = compileText(GOOD, "apps/a/kb/one.yaml");
		if (!expected.ok) throw new Error("fixture must compile");
		expect(h.readText("/repo/apps/a/kb/dist/one.json")).toBe(expected.json);
	});

	it("writes nothing for any file when one file has an error", () => {
		const h = host({
			"apps/a/kb/good.yaml": GOOD,
			"apps/b/kb/bad.yaml": BAD,
		});
		const r = runCli(["build"], h);
		expect(r.exitCode).toBe(1);
		expect(h.writes).toEqual([]);
		expect(h.madeDirs).toEqual([]);
		expect(r.stdout).toContain("2 files checked, 1 errors, 0 warnings");
	});

	it("is repeatable: a second run leaves every output byte-identical", () => {
		const h = host({ "apps/a/kb/one.yaml": GOOD });
		runCli(["build"], h);
		const first = new Uint8Array(
			h.files.get("/repo/apps/a/kb/dist/one.json") as Uint8Array,
		);
		const r = runCli(["build"], h);
		expect(r.exitCode).toBe(0);
		expect(h.files.get("/repo/apps/a/kb/dist/one.json")).toEqual(first);
	});

	it("reports a failing write and exits 1", () => {
		const h = host(
			{ "apps/a/kb/one.yaml": GOOD, "apps/a/kb/two.yaml": GOOD },
			{ failOn: { "apps/a/kb/dist/one.json": "EACCES: permission denied" } },
		);
		const r = runCli(["build"], h);
		expect(r.exitCode).toBe(1);
		expect(r.stderr).toBe(
			"apps/a/kb/dist/one.json: error EACCES: permission denied\n",
		);
		// The other file is still written.
		expect(h.readText("/repo/apps/a/kb/dist/two.json")).toBeDefined();
	});

	it("reports a failing makeDir and exits 1", () => {
		const h = host(
			{ "apps/a/kb/one.yaml": GOOD },
			{ failOn: { "apps/a/kb/dist": "EROFS: read-only file system" } },
		);
		const r = runCli(["build"], h);
		expect(r.exitCode).toBe(1);
		expect(r.stderr).toBe(
			"apps/a/kb/dist/one.json: error EROFS: read-only file system\n",
		);
	});
});

describe("read problems", () => {
	it("a READ_ERROR gives exit 1 and names the operating-system reason", () => {
		const r = runCli(
			["validate"],
			host(
				{ "apps/a/kb/one.yaml": GOOD },
				{ failOn: { "apps/a/kb/one.yaml": "EACCES: permission denied" } },
			),
		);
		expect(r.exitCode).toBe(1);
		expect(r.stdout).toContain(
			"apps/a/kb/one.yaml: error READ_ERROR Cannot read 'apps/a/kb/one.yaml': EACCES: permission denied.",
		);
		expect(r.stdout).toContain("1 files checked, 1 errors, 0 warnings");
	});

	it("invalid UTF-8 prints the 'not valid UTF-8' message and exits 1", () => {
		const r = runCli(
			["validate"],
			host({ "apps/a/kb/one.yaml": new Uint8Array([0x69, 0x64, 0x3a, 0xff]) }),
		);
		expect(r.exitCode).toBe(1);
		expect(r.stdout).toContain("READ_ERROR");
		expect(r.stdout).toContain("not valid UTF-8");
	});

	it("an unreadable directory is reported on stderr with exit 1", () => {
		const r = runCli(
			["validate"],
			host(
				{ "apps/a/kb/one.yaml": GOOD },
				{ failOn: { "apps/a/kb": "EIO: i/o error" } },
			),
		);
		expect(r.exitCode).toBe(1);
		expect(r.stdout).toBe("");
		expect(r.stderr).toContain("EIO: i/o error");
	});
});

describe("usage errors", () => {
	const cases: [string, string[], Parameters<typeof host>[0]][] = [
		["no command", [], {}],
		["unknown command", ["frobnicate"], {}],
		["a flag argument", ["validate", "--fix"], {}],
		["an empty argument", ["build", ""], {}],
		["help with arguments", ["help", "extra"], {}],
		["a path matching no KB_File", ["validate", "docs/a.yaml"], {}],
		["a missing app", ["validate", "apps/nope"], {}],
		["a path with ..", ["validate", "apps/a/kb/../kb/one.yaml"], {}],
		["a nested file", ["validate", "apps/a/kb/sub/x.yaml"], {}],
		["a path outside the root", ["validate", "/elsewhere/a.yaml"], {}],
		["a dist file", ["validate", "apps/a/kb/dist/x.yaml"], {}],
	];
	it.each(cases)("%s: exit 2, usage on stderr, empty stdout", (_n, argv) => {
		const h = host({ "apps/a/kb/one.yaml": GOOD });
		const r = runCli(argv, h);
		expect(r.exitCode).toBe(2);
		expect(r.stdout).toBe("");
		expect(r.stderr).toContain("Usage:");
		expect(h.writes).toEqual([]);
	});

	it("no pnpm-workspace.yaml is a usage error", () => {
		const h = memoryHost({
			root: "/repo",
			files: { "apps/a/kb/one.yaml": GOOD },
			dirs: [],
		});
		const r = runCli(["validate"], h);
		expect(r.exitCode).toBe(2);
		expect(r.stdout).toBe("");
		expect(r.stderr).toContain("no repository root");
	});

	it("a bad path stops a build before anything is written", () => {
		const h = host({ "apps/a/kb/one.yaml": GOOD });
		const r = runCli(["build", "apps/a", "docs/x.yaml"], h);
		expect(r.exitCode).toBe(2);
		expect(h.writes).toEqual([]);
	});
});

describe("help", () => {
	it.each([["help"], ["--help"], ["-h"]])(
		"%s prints usage on stdout and exits 0",
		(flag) => {
			const r = runCli([flag], host({}));
			expect(r.exitCode).toBe(0);
			expect(r.stdout).toContain("Usage:");
			expect(r.stderr).toBe("");
		},
	);
});

describe("output order", () => {
	const files = {
		"apps/b/kb/z.yaml": BAD,
		"apps/a/kb/m.yaml": WARN,
		"apps/a/kb/a.yaml": BAD,
		"apps/c/kb/q.yaml": GOOD,
	};

	it("is sorted by file path", () => {
		const r = runCli(["validate"], host(files));
		const paths = r.stdout
			.trimEnd()
			.split("\n")
			.slice(0, -1)
			.map((l) => l.slice(0, l.indexOf(":")));
		expect(paths).toEqual([...paths].sort());
		expect(new Set(paths)).toEqual(
			new Set(["apps/a/kb/a.yaml", "apps/a/kb/m.yaml", "apps/b/kb/z.yaml"]),
		);
	});

	it("does not depend on directory listing order or argument order", () => {
		const base = runCli(["validate"], host(files));
		for (const shuffleSeed of [1, 2, 3, 99]) {
			expect(runCli(["validate"], host(files, { shuffleSeed }))).toEqual(base);
		}
		const explicit = runCli(
			["validate", "apps/c", "apps/b", "apps/a"],
			host(files),
		);
		expect(explicit).toEqual(base);
	});

	it("within a file follows the file's own diagnostic order, not the host's", () => {
		const text = `${WARN}\nextra: 1\n`;
		const a = runCli(["validate"], host({ "apps/a/kb/x.yaml": text }));
		const b = runCli(
			["validate"],
			host({ "apps/a/kb/x.yaml": text }, { shuffleSeed: 7 }),
		);
		expect(a).toEqual(b);
	});
});
