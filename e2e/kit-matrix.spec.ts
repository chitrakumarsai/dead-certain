import { expect, test } from "./kit-fixtures";

/**
 * The design's specimen matrix as data (design.md, "/kit gallery"). Every
 * component and state listed there must stay a specimen in the gallery.
 */
const MATRIX: Readonly<Record<string, readonly string[]>> = {
	Tokens: [
		"tokens-colour",
		"tokens-type",
		"tokens-spacing",
		"tokens-radius",
		"tokens-motion",
	],
	Button: ["primary", "secondary", "quiet"].flatMap((variant) =>
		["default", "disabled"].flatMap((state) =>
			["paper", "film"].map(
				(surface) => `button-${variant}-${state}-${surface}`,
			),
		),
	),
	Disclosure: [
		"disclosure-closed",
		"disclosure-open",
		"disclosure-nested-film",
	],
	SourceBadge: ["answered", "collected", "derived"].flatMap((source) =>
		["paper", "film"].map((surface) => `sourcebadge-${source}-${surface}`),
	),
	ClauseQuote: [
		"plain",
		"deciding",
		"deciding-mark",
		"mark-not-found",
		"long",
	].flatMap((state) =>
		["paper", "film"].map((surface) => `clausequote-${state}-${surface}`),
	),
	AnswerControl: [
		"answercontrol-boolean-empty",
		"answercontrol-enum-2",
		"answercontrol-enum-6",
		"answercontrol-enum-10",
		"answercontrol-money-empty",
		"answercontrol-money-typing",
		"answercontrol-money-filled",
		"answercontrol-money-zero",
		"answercontrol-money-invalid-empty",
		"answercontrol-money-below-min-amount",
		"answercontrol-number-unit",
		"answercontrol-number-plain",
		"answercontrol-date-empty",
		"answercontrol-boolean-disabled",
	],
	QuestionCard: [
		"questioncard-boolean",
		"questioncard-enum",
		"questioncard-money",
		"questioncard-number",
		"questioncard-date",
		"questioncard-why-only",
		"questioncard-clause-only",
		"questioncard-no-why",
		"questioncard-invalid",
		"questioncard-first",
		"questioncard-last",
	],
	AnswersRail: [
		"answersrail-empty",
		"answersrail-three",
		"answersrail-current",
		"answersrail-skipped",
		"answersrail-collapsed",
		"answersrail-rail",
	],
	VerdictHeadline: [
		"paid",
		"reduced",
		"denied",
		"ready",
		"not-ready",
		"undecided",
	].flatMap((state) =>
		["verdict", "summary"].map((size) => `verdictheadline-${state}-${size}`),
	),
	ProportionBar: [
		"proportionbar-all-paid",
		"proportionbar-one-cut",
		"proportionbar-many-cuts",
		"proportionbar-all-cut",
		"proportionbar-zero-parts",
	],
	Ledger: [
		"ledger-normal",
		"ledger-no-deductions",
		"ledger-zero",
		"ledger-unknown",
		"ledger-many",
		"ledger-selected",
		"ledger-wrap",
	],
	CheckRow: [
		"checkrow-pass",
		"checkrow-fail",
		"checkrow-unknown",
		"checkrow-evidence",
		"checkrow-non-boolean",
	],
	WhatIfList: [
		"whatiflist-money",
		"whatiflist-no-money",
		"whatiflist-edges",
		"whatiflist-empty",
	],
	ProofTree: [
		"prooftree-collapsed",
		"prooftree-expanded",
		"prooftree-deep",
		"prooftree-shared",
		"prooftree-collected",
		"prooftree-unknown",
		"prooftree-deciding",
		"prooftree-huge",
		"prooftree-keys-joint",
		"prooftree-keys-bone",
	],
	"Sheet, Film": ["sheet-paper", "film-side", "film-sheet"],
	// Open side, open sheet and reduced motion are shown by the 1280, 390/768
	// and reduced-motion projects (kit-xray-stage.spec.ts).
	XrayStage: ["xraystage-closed"],
	AppShell: [
		"appshell-desktop",
		"appshell-phone-closed",
		"appshell-phone-open",
	],
	StaleLinkNotice: [
		"stalelink-kb-mismatch",
		"stalelink-kb-mismatch-no-link",
		"stalelink-malformed",
		"stalelink-unsupported",
	],
	Screens: [
		"screen-start",
		"screen-question",
		"screen-verdict",
		"screen-xray",
		"screen-preflight",
		"screen-stale",
	],
};

const ALL = Object.values(MATRIX).flat();
/** Specimens whose live component sits on film. */
const isFilm = (id: string) =>
	/-film$/.test(id) || id.startsWith("prooftree-") || id === "film-side";
/** --lightbox, the page the paper sits on. */
const LIGHTBOX = "rgb(237, 242, 243)";

test("every cell of the design's specimen matrix is a specimen with a heading and a note", async ({
	page,
}) => {
	await page.goto("./kit/");

	for (const id of ALL) {
		const specimen = page.locator(`figure[data-specimen="${id}"]`);
		await expect(specimen, id).toHaveCount(1);
		await expect(specimen.locator(":scope > h3"), id).toHaveText(/\S/);
		await expect(specimen.locator(":scope > figcaption"), id).toHaveText(/\S/);
	}
});

test("every specimen's deep link scrolls it into view", async ({ page }) => {
	await page.goto("./kit/");

	for (const id of ALL) {
		await page.evaluate((target) => {
			location.hash = target;
		}, id);
		await expect(
			page.locator(`[data-specimen="${id}"] > h3`),
			id,
		).toBeInViewport();
	}
});

test("film specimens sit inside a film, and every specimen sits on the lightbox", async ({
	page,
}) => {
	await page.goto("./kit/");

	for (const id of ALL.filter(isFilm)) {
		await expect(
			page.locator(`[data-specimen="${id}"] [data-surface="film"]`).first(),
			id,
		).toBeVisible();
	}
	const grounds = await page
		.locator("figure[data-specimen]")
		.evaluateAll((figures) =>
			figures.map((figure) => {
				// The colour a specimen is drawn on: its nearest painted ancestor.
				let node: Element | null = figure;
				while (node) {
					const bg = getComputedStyle(node).backgroundColor;
					if (bg !== "rgba(0, 0, 0, 0)") return bg;
					node = node.parentElement;
				}
				return "none";
			}),
		);
	expect(new Set(grounds)).toEqual(new Set([LIGHTBOX]));
});
