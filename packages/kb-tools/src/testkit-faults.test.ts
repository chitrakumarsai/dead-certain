import { start } from "@dead-certain/engine";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { HostError, loadText } from "./index";
import {
	cyclicKbArb,
	type FaultName,
	faultArb,
	kbArb,
	memoryHost,
	REFERENCE_FAULTS,
	SCHEMA_FAULTS,
	treeArb,
} from "./testkit";

describe("faultArb", () => {
	it("injects every named fault with an expected code, id and name", () => {
		const seen = new Set<FaultName>();
		const arb = kbArb.chain((kb) => faultArb(kb));
		for (const f of fc.sample(arb, { numRuns: 300, seed: 11 })) {
			seen.add(f.fault);
			expect(f.expected.code).toBeTruthy();
			if (f.kind === "reference") {
				expect(f.expected.id).toBeTruthy();
				expect(f.expected.name).toBeTruthy();
			} else {
				expect(f.expected.name).toBeTruthy();
			}
			// The faulty text is readable YAML: the Loader never throws on it.
			expect(() => loadText(f.text, "kb.yaml")).not.toThrow();
		}
		expect(seen).toEqual(new Set([...REFERENCE_FAULTS, ...SCHEMA_FAULTS]));
	});

	it("reference faults leave a file that loads cleanly", () => {
		const arb = kbArb.chain((kb) => faultArb(kb, "reference"));
		for (const f of fc.sample(arb, { numRuns: 100, seed: 12 })) {
			expect(f.kind).toBe("reference");
			expect(loadText(f.text, "kb.yaml").diagnostics).toEqual([]);
		}
	});
});

describe("cyclicKbArb", () => {
	it("makes the engine throw CYCLE", () => {
		for (const kb of fc.sample(cyclicKbArb, { numRuns: 200, seed: 13 })) {
			expect(() => start(kb)).toThrow(
				expect.objectContaining({ code: "CYCLE" }),
			);
		}
	});
});

describe("treeArb and memoryHost", () => {
	it("lists exactly the KB_Files under apps/<app>/kb in any readDir order", () => {
		for (const tree of fc.sample(treeArb, { numRuns: 100, seed: 14 })) {
			const host = memoryHost(tree, { shuffleSeed: 7 });
			const found: string[] = [];
			const appsDir = `${tree.root}/apps`;
			const apps = host.stat(appsDir) === "dir" ? host.readDir(appsDir) : [];
			for (const app of apps) {
				if (app.kind !== "dir") continue;
				const kb = `${appsDir}/${app.name}/kb`;
				if (host.stat(kb) !== "dir") continue;
				for (const e of host.readDir(kb)) {
					if (e.kind === "file" && e.name.endsWith(".yaml")) {
						found.push(`apps/${app.name}/kb/${e.name}`);
					}
				}
			}
			expect(found.sort()).toEqual([...tree.kbFiles]);
		}
	});

	it("records writes and directory creation, and raises HostError on chosen paths", () => {
		const host = memoryHost(
			{ root: "/repo", files: { "a/b.txt": "hi" }, dirs: [] },
			{ failOn: { "a/bad.txt": "EACCES: permission denied" } },
		);
		host.makeDir("/repo/out/deep");
		host.writeFile("/repo/out/deep/x.json", "{}");
		expect(host.madeDirs).toEqual(["/repo/out/deep"]);
		expect(host.writes).toEqual(["/repo/out/deep/x.json"]);
		expect(host.readText("/repo/out/deep/x.json")).toBe("{}");
		expect(() => host.writeFile("/repo/a/bad.txt", "x")).toThrow(HostError);
		expect(() => host.readFile("/repo/missing")).toThrow(HostError);
		expect(() => host.writeFile("/repo/nodir/x", "x")).toThrow(HostError);
	});
});
