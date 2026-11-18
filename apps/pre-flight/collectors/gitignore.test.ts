import { describe, expect, it } from "vitest";
import { ignores } from "./gitignore";

const lines = (...ls: string[]) => ls.join("\n");

describe("ignores", () => {
	it("skips comments and blank lines", () => {
		expect(ignores(lines("# .kiro", "", "   "), ".kiro/")).toEqual({
			ignored: false,
		});
	});

	it("reports the matching line, 1-based, with its text", () => {
		expect(
			ignores(lines("node_modules/", "# tools", ".kiro/"), ".kiro/"),
		).toEqual({
			ignored: true,
			line: 3,
			text: ".kiro/",
		});
	});

	it("matches a directory-only pattern against directories, not files", () => {
		expect(ignores("build/", "build/")).toMatchObject({ ignored: true });
		expect(ignores("build/", "build")).toMatchObject({ ignored: false });
		expect(ignores("build/", "build/out.js")).toMatchObject({ ignored: true });
	});

	it("anchors a leading slash to the root, and leaves a bare name free to match at any depth", () => {
		expect(ignores("/dist", "dist/")).toMatchObject({ ignored: true });
		expect(ignores("/dist", "app/dist/")).toMatchObject({ ignored: false });
		expect(ignores("dist", "app/dist/")).toMatchObject({ ignored: true });
	});

	it("anchors a pattern with a slash in the middle", () => {
		expect(ignores("docs/build", "docs/build/")).toMatchObject({
			ignored: true,
		});
		expect(ignores("docs/build", "x/docs/build/")).toMatchObject({
			ignored: false,
		});
	});

	it("lets a later ! line re-include, and reports the deciding line", () => {
		expect(ignores(lines("*.log", "!keep.log"), "keep.log")).toEqual({
			ignored: false,
			line: 2,
			text: "!keep.log",
		});
		expect(ignores(lines("!keep.log", "*.log"), "keep.log")).toEqual({
			ignored: true,
			line: 2,
			text: "*.log",
		});
	});

	it("cannot re-include a file whose parent directory is ignored", () => {
		expect(
			ignores(lines(".kiro/", "!.kiro/specs/tasks.md"), ".kiro/specs/tasks.md"),
		).toEqual({
			ignored: true,
			line: 1,
			text: ".kiro/",
		});
	});

	it("reads * and ? within one segment", () => {
		expect(ignores("*.md", "docs/a.md")).toMatchObject({ ignored: true });
		expect(ignores("a?.txt", "ab.txt")).toMatchObject({ ignored: true });
		expect(ignores("a?.txt", "a/.txt")).toMatchObject({ ignored: false });
		expect(ignores("src/*.js", "src/a/b.js")).toMatchObject({ ignored: false });
	});

	it("reads ** at the start, the end and the middle", () => {
		expect(ignores("**/.kiro", "a/b/.kiro/")).toMatchObject({ ignored: true });
		expect(ignores(".kiro/**", ".kiro/specs/x.md")).toMatchObject({
			ignored: true,
		});
		expect(ignores("a/**/z", "a/b/c/z")).toMatchObject({ ignored: true });
		expect(ignores("a/**/z", "a/z")).toMatchObject({ ignored: true });
	});

	it("reads an escaped # or ! as a literal first character", () => {
		expect(ignores("\\#notes", "#notes")).toMatchObject({ ignored: true });
		expect(ignores("\\!important", "!important")).toMatchObject({
			ignored: true,
		});
	});

	it("trims unescaped trailing spaces", () => {
		expect(ignores(".kiro/   ", ".kiro/")).toMatchObject({ ignored: true });
	});

	it("reads Windows line endings", () => {
		expect(ignores("a\r\n.kiro\r\n", ".kiro/")).toEqual({
			ignored: true,
			line: 2,
			text: ".kiro",
		});
	});

	it.each(["[abc].md", "file\\ name", "a\\*b"])(
		"refuses %j as unsupported, wherever it sits",
		(pattern) => {
			expect(ignores(lines(pattern, ".kiro/"), ".kiro/")).toEqual({
				unsupported: true,
				line: 1,
				text: pattern,
			});
		},
	);
});
