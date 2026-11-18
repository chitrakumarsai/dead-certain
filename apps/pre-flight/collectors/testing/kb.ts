// Test-only: the real Pre-Flight knowledge base, compiled from its YAML.
// @ts-expect-error TS2591: no type definitions for node:fs
import { readFileSync } from "node:fs";
import type { KnowledgeBase } from "@dead-certain/engine";
import { compileText } from "@dead-certain/kb-tools";

export function preflightKb(): KnowledgeBase {
	const result = compileText(
		readFileSync(
			new URL("../../kb/checklist.yaml", import.meta.url),
			"utf8",
		) as string,
		"checklist.yaml",
	);
	if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
	return JSON.parse(result.json) as KnowledgeBase;
}
