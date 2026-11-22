// Test-only. The compiled Claim Check knowledge base, compiled from its YAML so
// tests do not depend on an earlier `dc build`. Same compiler, same JSON.
// @ts-expect-error TS2591: no type definitions for node:fs
import { readFileSync } from "node:fs";
import type { KnowledgeBase } from "@dead-certain/engine";
import { compileText } from "@dead-certain/kb-tools";

let cached: KnowledgeBase | undefined;

export function claimKb(): KnowledgeBase {
	if (cached) return cached;
	const file = new URL(
		"../../../../claim-check/kb/policy.yaml",
		import.meta.url,
	);
	const result = compileText(
		readFileSync(file, "utf8") as string,
		"policy.yaml",
	);
	if (!result.ok)
		throw new Error("apps/claim-check/kb/policy.yaml does not compile");
	cached = JSON.parse(result.json) as KnowledgeBase;
	return cached;
}
