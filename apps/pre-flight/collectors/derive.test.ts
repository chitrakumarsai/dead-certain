import { beforeAll, describe, expect, it } from "vitest";
import { deriveFacts } from "./derive";
import { EXTRACTORS } from "./extractors";
import { preflightKb } from "./testing/kb";
import { recordedSnapshot } from "./testing/snapshots";
import type { RepoSnapshot } from "./types";

const kb = preflightKb();
let self: RepoSnapshot;
let notReady: RepoSnapshot;
let warnings: RepoSnapshot;
beforeAll(async () => {
	self = await recordedSnapshot("dead-certain");
	notReady = await recordedSnapshot("dc-sample-not-ready");
	warnings = await recordedSnapshot("dc-sample-warnings");
});

describe("deriveFacts on the recorded repositories", () => {
	it("reads this repository as recorded from main", () => {
		const d = deriveFacts(self, kb);
		expect(d.facts).toEqual({
			repo_private: false,
			license_detected: true,
			repo_archived: false,
			license_file_at_root: true,
			kiro_dir_has_file: true,
			kiro_spec_with_tasks: true,
			apps_dir_count: 3,
			// apps/pre-flight has no package.json on main yet.
			apps_with_package_json: 2,
			gitignore_ignores_kiro: false,
			// The README's run heading is "Run it", not one of the seven names.
			readme_has_run_heading: false,
		});
		expect(d.unseen).toEqual(["demo_video_seconds"]);
	});

	it("reads dc-sample-not-ready: no licence and .kiro ignored", () => {
		const d = deriveFacts(notReady, kb);
		expect(d.facts).toMatchObject({
			license_detected: false,
			license_file_at_root: false,
			kiro_dir_has_file: false,
			kiro_spec_with_tasks: false,
			gitignore_ignores_kiro: true,
			readme_has_run_heading: true,
			apps_dir_count: 2,
			apps_with_package_json: 2,
		});
		expect(d.evidence.gitignore_ignores_kiro).toBe(".gitignore line 2: .kiro/");
	});

	it("reads dc-sample-warnings: a .kiro file but no spec, and no run heading", () => {
		expect(deriveFacts(warnings, kb).facts).toMatchObject({
			license_detected: true,
			license_file_at_root: true,
			kiro_dir_has_file: true,
			kiro_spec_with_tasks: false,
			gitignore_ignores_kiro: false,
			readme_has_run_heading: false,
		});
	});

	it("gives one evidence line for every fact it returns, none longer than 200 characters", () => {
		for (const s of [self, notReady, warnings]) {
			const d = deriveFacts(s, kb);
			expect(Object.keys(d.evidence).sort()).toEqual(
				Object.keys(d.facts).sort(),
			);
			for (const line of Object.values(d.evidence))
				expect(line.length).toBeLessThanOrEqual(200);
		}
	});

	it("returns only non-derived facts, and every other non-derived fact is unseen (3.15, 3.16)", () => {
		const nonDerived = Object.entries(kb.facts)
			.filter(([, def]) => def.derived !== true)
			.map(([f]) => f)
			.sort();
		const d = deriveFacts(self, kb);
		expect([...Object.keys(d.facts), ...d.unseen].sort()).toEqual(nonDerived);
	});
});

describe("deriveFacts never guesses", () => {
	it("leaves every tree fact unseen when the tree is truncated (3.9)", () => {
		const d = deriveFacts(
			{ ...self, tree: { ...self.tree, truncated: true } },
			kb,
		);
		for (const fact of [
			"license_file_at_root",
			"kiro_dir_has_file",
			"kiro_spec_with_tasks",
			"apps_dir_count",
			"apps_with_package_json",
		]) {
			expect(d.facts).not.toHaveProperty(fact);
			expect(d.unseen).toContain(fact);
		}
		expect(d.facts.license_detected).toBe(true);
	});

	it("keeps a value only when its type matches the fact's type", () => {
		const d = deriveFacts(self, kb, {
			...EXTRACTORS,
			repo_archived: {
				reads: "metadata",
				read: () => ({ value: "no", evidence: "wrong type" }),
			},
			apps_dir_count: {
				reads: "tree",
				read: () => ({ value: Number.NaN, evidence: "not a number" }),
			},
		});
		expect(d.unseen).toEqual(
			expect.arrayContaining(["repo_archived", "apps_dir_count"]),
		);
		expect(d.facts).not.toHaveProperty("repo_archived");
	});

	it("clips evidence to 200 characters", () => {
		const d = deriveFacts(self, kb, {
			...EXTRACTORS,
			repo_archived: {
				reads: "metadata",
				read: () => ({ value: false, evidence: "e".repeat(500) }),
			},
		});
		expect(d.evidence.repo_archived).toHaveLength(200);
	});

	it("asks when git and the knowledge base's six lines disagree about .kiro", () => {
		for (const text of ["**/.kiro\n", ".kiro/\n!.kiro/\n", "[.]kiro\n"]) {
			const d = deriveFacts(
				{ ...self, gitignore: { text, clipped: false } },
				kb,
			);
			expect(d.unseen, text).toContain("gitignore_ignores_kiro");
		}
	});

	it("reads no .gitignore as not ignoring .kiro", () => {
		expect(
			deriveFacts({ ...self, gitignore: null }, kb).facts
				.gitignore_ignores_kiro,
		).toBe(false);
	});

	it("asks about the run heading when a clipped README has none, and reads it when absent", () => {
		const clipped = {
			text: "# Title\n\nNothing here yet.",
			clipped: true,
			name: "README.md",
		};
		expect(deriveFacts({ ...self, readme: clipped }, kb).unseen).toContain(
			"readme_has_run_heading",
		);
		expect(
			deriveFacts({ ...self, readme: null }, kb).facts.readme_has_run_heading,
		).toBe(false);
	});

	it("matches the run heading as a whole line, any level, any case, ATX or underlined", () => {
		const has = (text: string) =>
			deriveFacts(
				{ ...self, readme: { text, clipped: false, name: "README.md" } },
				kb,
			).facts.readme_has_run_heading;
		expect(has("## Getting Started")).toBe(true);
		expect(has("###### quick start ##")).toBe(true);
		expect(has("Usage\n=====")).toBe(true);
		expect(has("Install\n-------")).toBe(true);
		expect(has("## Getting started with Docker")).toBe(false);
		expect(has("Run it")).toBe(false);
		expect(has("    ## Usage")).toBe(false);
	});

	describe("readme_has_run_heading skips code and thematic breaks (3.22)", () => {
		const has = (text: string) =>
			deriveFacts(
				{ ...self, readme: { text, clipped: false, name: "README.md" } },
				kb,
			).facts.readme_has_run_heading;

		it("does not read a shell comment in a fenced block as a heading", () => {
			expect(has("# Tool\n\n```sh\n# Install\nnpm i\n```\n")).toBe(false);
			expect(has("# Tool\n\n~~~\n# Usage\n~~~\n")).toBe(false);
		});

		it("treats an unclosed fence as running to the end", () => {
			expect(has("# Tool\n```\n# Install\n")).toBe(false);
		});

		it("does not read Usage over *** as a heading", () => {
			expect(has("Usage\n***")).toBe(false);
		});

		it("still reads a real heading after a closed fence", () => {
			expect(has("```\n# not this\n```\n## Getting started\n")).toBe(true);
		});
	});
});
