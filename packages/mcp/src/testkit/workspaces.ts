// Test-only helpers: in-memory workspaces and the repo's real knowledge bases.
/// <reference types="vite/client" />

import type { FactValue } from "@dead-certain/engine";
import { loadGolden } from "@dead-certain/kb-tools";
import { makeWorkspace, type Workspace } from "../workspace";
import { type MemoryHost, memoryHost } from "./memory-host";

/** The smallest valid knowledge base (kb-tools' toy-money fixture). */
export const TOY_KB = `id: toy-money
currency: INR
goals: [payable]
facts:
  sum_insured:
    type: money
    ask: What is the sum insured?
  payable:
    type: money
    derived: true
rules:
  - id: R-1
    cite: "4.2"
    set: payable
    to: round(sum_insured * 0.01)
    because: One percent of the sum insured, rounded to whole minor units.
clauses:
  "4.2":
    title: Room rent
    text: Room rent is capped at one percent of the sum insured.
`;

const realKbs: Record<string, string> = import.meta.glob(
	"../../../../apps/*/kb/*.yaml",
	{ eager: true, query: "?raw", import: "default" },
);
const realGolden: Record<string, string> = import.meta.glob(
	"../../../../apps/*/golden/scenarios.yaml",
	{ eager: true, query: "?raw", import: "default" },
);

/** The text of a real KB_File, by KB_Ref (for example `claim-check/policy`). */
export function realKb(ref: string): string {
	const [app, stem] = ref.split("/");
	const text = realKbs[`../../../../apps/${app}/kb/${stem}.yaml`];
	if (text === undefined) throw new Error(`no real knowledge base ${ref}`);
	return text;
}

/** The text of an app's golden scenarios file. */
export function realGoldenText(app: string): string {
	const text = realGolden[`../../../../apps/${app}/golden/scenarios.yaml`];
	if (text === undefined) throw new Error(`no golden file for ${app}`);
	return text;
}

export interface TestWorkspace {
	readonly ws: Workspace;
	readonly host: MemoryHost;
}

/**
 * A workspace rooted at /ws. `kbs` maps a KB_Ref to its text. `extra` adds
 * other files by path relative to /ws.
 */
export function workspaceOf(
	kbs: Readonly<Record<string, string | Uint8Array>>,
	extra: Readonly<Record<string, string | Uint8Array>> = {},
	links: readonly string[] = [],
): TestWorkspace {
	const files: Record<string, string | Uint8Array> = {
		"/ws/pnpm-workspace.yaml": "packages:\n  - apps/*\n",
	};
	for (const [ref, text] of Object.entries(kbs)) {
		const [app, stem] = ref.split("/");
		files[`/ws/apps/${app}/kb/${stem}.yaml`] = text;
	}
	for (const [path, text] of Object.entries(extra)) files[`/ws/${path}`] = text;
	const host = memoryHost(files, { links: links.map((l) => `/ws/${l}`) });
	return { ws: makeWorkspace(host), host };
}

/** A golden scenario's answers and expectations, read with kb-tools' loader. */
export function goldenScenario(app: string, id: string) {
	const loaded = loadGolden(
		realGoldenText(app),
		`apps/${app}/golden/scenarios.yaml`,
	);
	if (!loaded.ok) throw new Error("golden file does not load");
	const scenario = loaded.set.scenarios.find((s) => s.id === id);
	if (scenario === undefined) throw new Error(`no scenario ${id}`);
	const facts: Record<string, FactValue> = {};
	for (const [name, value] of Object.entries(scenario.facts)) {
		if (value !== null) facts[name] = value;
	}
	const expected = scenario.expect;
	if (!("goals" in expected)) throw new Error(`${id} expects a question`);
	return {
		facts,
		goals: expected.goals,
		lineItems: expected.lineItems ?? {},
		scenario,
	};
}

/** The real workspace: both app knowledge bases. */
export function realWorkspace(): TestWorkspace {
	return workspaceOf({
		"claim-check/policy": realKb("claim-check/policy"),
		"pre-flight/checklist": realKb("pre-flight/checklist"),
	});
}
