/// <reference types="vite/client" />
import { describe, expect, it } from "vitest";

const kbToolsRaw: Record<string, string> = import.meta.glob("../package.json", {
	eager: true,
	query: "?raw",
	import: "default",
});
const engineRaw: Record<string, string> = import.meta.glob(
	"../../engine/package.json",
	{ eager: true, query: "?raw", import: "default" },
);

interface Manifest {
	name?: string;
	bin?: Record<string, string>;
	scripts?: Record<string, string>;
	dependencies?: Record<string, string>;
	devDependencies?: Record<string, string>;
}

const pkg = JSON.parse(Object.values(kbToolsRaw)[0] ?? "{}") as Manifest;
const engine = JSON.parse(Object.values(engineRaw)[0] ?? "{}") as Manifest;

const EXACT = /^\d+\.\d+\.\d+$/;
const LIFECYCLE = [
	"preinstall",
	"install",
	"postinstall",
	"prepublish",
	"prepare",
	"prepack",
	"postpack",
	"preuninstall",
	"uninstall",
	"postuninstall",
];

describe("kb-tools package.json", () => {
	it("is named @dead-certain/kb-tools", () => {
		expect(pkg.name).toBe("@dead-certain/kb-tools");
	});

	it("pins zod and yaml to exact versions with no range operator", () => {
		expect(pkg.dependencies?.zod).toMatch(EXACT);
		expect(pkg.dependencies?.yaml).toMatch(EXACT);
	});

	it("depends on the engine through workspace:*", () => {
		expect(pkg.dependencies?.["@dead-certain/engine"]).toBe("workspace:*");
	});

	it("has only exact fast-check and vite under devDependencies, and no vitest", () => {
		expect(Object.keys(pkg.devDependencies ?? {}).sort()).toEqual([
			"fast-check",
			"vite",
		]);
		expect(pkg.devDependencies?.["fast-check"]).toMatch(EXACT);
		expect(pkg.devDependencies?.vite).toMatch(EXACT);
		expect(pkg.dependencies?.vitest).toBeUndefined();
	});

	it("has a build script and no lifecycle script", () => {
		expect(pkg.scripts?.build).toBeTruthy();
		for (const name of LIFECYCLE) {
			expect(pkg.scripts?.[name]).toBeUndefined();
		}
	});

	it("declares a dc bin entry", () => {
		expect(pkg.bin?.dc).toBeTruthy();
	});

	it("leaves the engine with no runtime dependencies", () => {
		expect(engine.dependencies).toBeUndefined();
	});
});
