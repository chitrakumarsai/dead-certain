/// <reference types="vite/client" />
import { describe, expect, it } from "vitest";
import { validateText } from "./index";

// The project has no Node type definitions, so the files are read through
// Vite's build-time glob instead of node:fs. Keys are paths from this file.
const appFiles: Record<string, string> = import.meta.glob(
	"../../../apps/*/kb/*.yaml",
	{ eager: true, query: "?raw", import: "default" },
);
const fixtureFiles: Record<string, string> = import.meta.glob(
	"../fixtures/*.yaml",
	{ eager: true, query: "?raw", import: "default" },
);

const name =
	Object.keys(appFiles).length === 0
		? "no MONEY_NOT_ROUNDED in fixtures (apps/*/kb has no files, fixtures only)"
		: "no MONEY_NOT_ROUNDED in apps/*/kb and fixtures";

describe("MONEY_NOT_ROUNDED repository check", () => {
	it("has at least one fixture to check", () => {
		expect(Object.keys(fixtureFiles).length).toBeGreaterThan(0);
	});

	it("toy-money.yaml is a valid knowledge base", () => {
		const text = fixtureFiles["../fixtures/toy-money.yaml"] ?? "";
		const result = validateText(text, "toy-money.yaml");
		expect(result.diagnostics.filter((d) => d.severity === "error")).toEqual(
			[],
		);
	});

	it(name, () => {
		const all = { ...appFiles, ...fixtureFiles };
		const bad = Object.entries(all).flatMap(([path, text]) =>
			validateText(text, path)
				.diagnostics.filter((d) => d.code === "MONEY_NOT_ROUNDED")
				.map((d) => `${path}: ${d.message}`),
		);
		expect(bad).toEqual([]);
	});
});
