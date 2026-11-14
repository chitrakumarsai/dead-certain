import { describe, expect, it } from "vitest";
import { memoryHost } from "../testkit";
import { discover, discoverGolden } from "./discover";

const WORKSPACE = "packages:\n  - apps/*\n";

function host(files: Record<string, string>, dirs: string[] = []) {
	return memoryHost({
		root: "/repo",
		files: { "pnpm-workspace.yaml": WORKSPACE, ...files },
		dirs,
	});
}

const TREE = {
	"apps/a/kb/p.yaml": "id: a\n",
	"apps/a/golden/one.yaml": "kb: a\n",
	"apps/a/golden/two.yaml": "kb: a\n",
	"apps/a/golden/notes.md": "x",
	"apps/a/golden/sub/deep.yaml": "x",
	"apps/b/golden/main.yaml": "kb: b\n",
	"apps/c/kb/q.yaml": "id: c\n",
};

describe("discoverGolden", () => {
	it("finds every apps/*/golden/*.yaml with no path, sorted, and every app is whole", () => {
		const result = discoverGolden([], host(TREE));

		expect(result).toEqual({
			ok: true,
			root: "/repo",
			files: [
				"apps/a/golden/one.yaml",
				"apps/a/golden/two.yaml",
				"apps/b/golden/main.yaml",
			],
			wholeApps: ["a", "b", "c"],
		});
	});

	it("takes a directory as the whole app", () => {
		expect(discoverGolden(["apps/a"], host(TREE))).toMatchObject({
			ok: true,
			files: ["apps/a/golden/one.yaml", "apps/a/golden/two.yaml"],
			wholeApps: ["a"],
		});
	});

	it("takes a file as itself and not as the whole app", () => {
		expect(
			discoverGolden(["apps/a/golden/two.yaml"], host(TREE)),
		).toMatchObject({
			ok: true,
			files: ["apps/a/golden/two.yaml"],
			wholeApps: [],
		});
	});

	it("makes the app whole when its file and its directory are both passed", () => {
		expect(
			discoverGolden(["apps/a/golden/two.yaml", "apps/a"], host(TREE)),
		).toMatchObject({
			ok: true,
			files: ["apps/a/golden/one.yaml", "apps/a/golden/two.yaml"],
			wholeApps: ["a"],
		});
	});

	it("accepts an absolute path inside the root", () => {
		expect(
			discoverGolden(["/repo/apps/b/golden/main.yaml"], host(TREE)),
		).toMatchObject({ ok: true, files: ["apps/b/golden/main.yaml"] });
	});

	it("returns no file for a tree with no golden directory", () => {
		expect(discoverGolden([], host({ "apps/x/kb/p.yaml": "id: x\n" }))).toEqual(
			{
				ok: true,
				root: "/repo",
				files: [],
				wholeApps: ["x"],
			},
		);
	});

	it.each([
		["a path under kb/", "apps/a/kb/p.yaml"],
		["a missing file", "apps/a/golden/missing.yaml"],
		["a non-YAML file", "apps/a/golden/notes.md"],
		["a nested file", "apps/a/golden/sub/deep.yaml"],
		["an app with no golden files", "apps/c"],
		["a path outside the root", "../etc/passwd"],
		["an unrelated path", "docs"],
	])("is a usage error for %s", (_, path) => {
		const result = discoverGolden([path], host(TREE));

		expect(result).toEqual({
			ok: false,
			kind: "usage",
			message: `dc: '${path}' matches no golden file (expected apps/<app>/golden/<name>.yaml or apps/<app>).`,
		});
	});

	it("is a usage error outside a workspace", () => {
		const result = discoverGolden(
			[],
			memoryHost({ root: "/repo", files: {}, dirs: [] }),
		);

		expect(result).toMatchObject({ ok: false, kind: "usage" });
	});

	it("does not change what validate and build discover", () => {
		const without = discover([], host({ "apps/a/kb/p.yaml": "id: a\n" }));
		const withGolden = discover([], host(TREE));

		expect(without).toMatchObject({ ok: true, files: ["apps/a/kb/p.yaml"] });
		expect(withGolden).toMatchObject({
			ok: true,
			files: ["apps/a/kb/p.yaml", "apps/c/kb/q.yaml"],
		});
		expect(discover(["apps/a/golden/one.yaml"], host(TREE))).toMatchObject({
			ok: false,
			kind: "usage",
		});
	});
});
