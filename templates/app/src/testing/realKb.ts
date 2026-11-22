// Test-only. Compiles the YAML so tests do not depend on a prior `dc build`.
// @ts-expect-error TS2591: no type definitions for node:fs
import { readFileSync } from "node:fs";
import type { KnowledgeBase } from "@dead-certain/engine";
import { compileText } from "@dead-certain/kb-tools";

let cached: KnowledgeBase | undefined;

export function realKb(): KnowledgeBase {
	if (cached) return cached;
	const file = new URL("../../kb/starter.yaml", import.meta.url);
	const result = compileText(
		readFileSync(file, "utf8") as string,
		"starter.yaml",
	);
	if (!result.ok) throw new Error("kb/starter.yaml does not compile");
	cached = JSON.parse(result.json) as KnowledgeBase;
	return cached;
}
