// What the three OG images show (seo requirements 7.2 to 7.4). Pure: the
// fixture page renders these scenes, and og.test.ts recomputes them with no
// browser and compares them with apps/site/public/og/og.json.
import {
	audit,
	explain,
	type FactValue,
	type KnowledgeBase,
	type LineItem,
	type ProofNode,
} from "@dead-certain/engine";
import { HEADLINE } from "../../landing/Hero";
import { withPrintedBecause } from "../../landing/hero/because";
import { STATE_GOAL, STEP_FACT } from "../../landing/hero/config";
import { type HeroModel, heroModel } from "../../landing/hero/model";
import { labelFor } from "../../landing/kb";

export type OgKey = "home" | "claimCheck" | "preFlight";

export interface OgEntry {
	/** Under apps/site/public/. */
	file: string;
	/** og:image:alt, at most 125 characters (7.4). */
	alt: string;
	/** Every string the image shows, each in the rendered frame's text. */
	text: string[];
}

export const PREFLIGHT_TITLE = "Check a repository before you submit it";

/** A sample repository: two checks fail, one a blocker and one a warning. */
const PREFLIGHT_FACTS: Readonly<Record<string, FactValue>> = {
	repo_private: false,
	license_detected: true,
	license_file_at_root: true,
	kiro_dir_has_file: true,
	gitignore_ignores_kiro: true,
	readme_has_run_heading: false,
};
/** Three that pass, the blocker that fails (R-05), the warning that fails (R-07). */
const PREFLIGHT_SHOWN = [
	"repo_public",
	"has_open_licence",
	"kiro_dir_present",
	"kiro_dir_committed",
	"readme_run_section",
];

export interface OgScenes {
	model: HeroModel;
	/** The verdict's proof, cut to its root and first two causes. */
	proof: ProofNode;
	/** The ledger line the Claim Check image highlights. */
	highlight: LineItem;
	checks: LineItem[];
	entries: Record<OgKey, OgEntry>;
}

const ALT_MAX = 125;
const WORDS = ["no", "one", "two", "three", "four", "five"];
const count = (n: number) => WORDS[n] ?? String(n);

export function ogScenes(
	claimKb: KnowledgeBase,
	preflightKb: KnowledgeBase,
): OgScenes {
	const model = heroModel(claimKb);
	if ("kind" in model)
		throw new Error(`The hero claim does not work out: ${model.reason}`);
	const full = withPrintedBecause(
		explain(model.session, STATE_GOAL),
		model.session,
	);
	const proof: ProofNode = {
		...full,
		children: full.children.slice(0, 2).map((c) => ({ ...c, children: [] })),
	};
	const highlight = model.ledger.items.find((i) => i.fact === STEP_FACT);
	if (!highlight?.clause) throw new Error(`${STEP_FACT} has no clause`);
	const verdict = audit(preflightKb, PREFLIGHT_FACTS);
	const checks = PREFLIGHT_SHOWN.map((fact) => {
		const item = verdict.lineItems.find((i) => i.fact === fact);
		if (!item) throw new Error(`Pre-Flight has no check ${fact}`);
		return item;
	});
	const passed = checks.filter((c) => c.value === true).length;
	const label = (fact: string) => labelFor(claimKb, fact);
	const entries: Record<OgKey, OgEntry> = {
		home: {
			file: "og/home.png",
			alt: `The Dead Certain wordmark and tagline beside a sample verdict, ${model.statement}, with its proof.`,
			text: [
				"Dead Certain",
				HEADLINE,
				model.statement,
				// The tree names each node by the rule that decided it.
				...[proof, ...proof.children].map((n) => n.rule ?? label(n.fact)),
			],
		},
		claimCheck: {
			file: "og/claim-check.png",
			alt: `A sample claim: ${model.statement}. The ${highlight.label.toLowerCase()} line and its clause are marked.`,
			text: [
				model.statement,
				model.ledger.claimed.label,
				...model.ledger.items.map((i) => i.label),
				model.ledger.payable.label,
				highlight.clause,
			],
		},
		preFlight: {
			file: "og/pre-flight.png",
			alt: `Five Pre-Flight checks on a sample repository: ${count(passed)} passed and ${count(checks.length - passed)} failed, each with its rule.`,
			text: [PREFLIGHT_TITLE, ...checks.flatMap((c) => [c.label, c.rule])],
		},
	};
	for (const [key, entry] of Object.entries(entries))
		if (entry.alt.length > ALT_MAX)
			throw new Error(`${key}: the alt text is over ${ALT_MAX} characters`);
	return { model, proof, highlight, checks, entries };
}
