import { answer, encode, start } from "@dead-certain/engine";
import type { Page } from "@playwright/test";
import { answerInUi, claimKb, money, verdictFor } from "./claim-check-engine";
import { openClaimCheck, startCheck } from "./claim-check-helpers";
import { expect, expectNoAxeViolations, test } from "./kit-fixtures";

const DENIED = {
	claimed: 1_00_000_00,
	cause: "accident",
	treatment: "cosmetic",
};
const REDUCED = {
	claimed: 2_00_000_00,
	cause: "accident",
	treatment: "other",
	treated_outside_india: false,
	annexure_items: 2_000_00,
	room_rent_per_day: 6_000_00,
	sum_insured: "five_lakh",
	room_days: 5,
	age: 65,
	paid_this_year: 0,
};

const tokenFor = (
	answers: Record<string, string | number | boolean>,
	kb = claimKb,
) =>
	encode(
		Object.entries(answers).reduce((s, [f, v]) => answer(s, f, v), start(kb)),
	);

// The token is base64url; its first byte is the format version.
const base64url = {
	decode: (t: string) =>
		Uint8Array.from(atob(t.replaceAll("-", "+").replaceAll("_", "/")), (c) =>
			c.charCodeAt(0),
		),
	encode: (b: Uint8Array) =>
		btoa(String.fromCharCode(...b))
			.replaceAll("+", "-")
			.replaceAll("/", "_")
			.replace(/=+$/, ""),
};

const hashOf = (page: Page) => new URL(page.url()).hash;
const headline = (page: Page) => page.getByRole("heading", { level: 1 });

async function expectNotice(page: Page, heading: RegExp) {
	await expect(page.getByRole("heading", { level: 2 })).toHaveText(heading);
	await expect(page.getByRole("heading", { level: 2 })).toBeFocused();
	await expect(page.getByRole("button", { name: "Continue" })).toHaveCount(0);
	await expect(
		page.getByRole("button", { name: "See why", exact: true }),
	).toHaveCount(0);
}

test("the fragment follows each answer and empties on start over", async ({
	page,
}) => {
	await startCheck(page);
	expect(hashOf(page)).toBe("#/");
	await answerInUi(page, DENIED);
	expect(hashOf(page)).toBe(`#/?r=${tokenFor(DENIED)}`);
	await page.getByRole("button", { name: "Start over" }).click();
	expect(hashOf(page)).toBe("#/");
});

test("the same link opens the same verdict and ledger in a new page", async ({
	page,
}) => {
	await openClaimCheck(page, `#/?r=${tokenFor(REDUCED)}`);
	const verdict = verdictFor(REDUCED);
	await expect(headline(page)).toContainText(
		`${money(verdict.goals.payable as number)} of ${money(REDUCED.claimed)} will be paid`,
	);
	const ledger = await page.getByRole("table").textContent();
	const other = await page.context().newPage();
	await openClaimCheck(other, hashOf(page));
	expect(await other.getByRole("table").textContent()).toBe(ledger);
});

test("editing the fragment while open decodes it again", async ({ page }) => {
	await openClaimCheck(page, `#/?r=${tokenFor(REDUCED)}`);
	await expect(headline(page)).toContainText("Paid in part");
	await page.evaluate(
		(hash) => {
			location.hash = hash;
		},
		`#/?r=${tokenFor(DENIED)}`,
	);
	await expect(headline(page)).toContainText("Not paid");
});

test("a link made with other rules shows the KB_MISMATCH notice", async ({
	page,
}) => {
	const token = tokenFor(
		{ claimed: 100_00 },
		{ ...claimKb, id: "an-older-policy" },
	);
	await openClaimCheck(page, `#/?r=${token}`);
	await expectNotice(page, /older rules/);
	await expect(
		page.getByRole("link", { name: "Read the rules" }),
	).toHaveAttribute("href", "#/rulebook");
	await expectNoAxeViolations(page);
});

test("a cut token shows MALFORMED_TOKEN, and Start the check clears it", async ({
	page,
}) => {
	await openClaimCheck(page, `#/?r=${tokenFor(DENIED).slice(0, 12)}`);
	await expectNotice(page, /incomplete or damaged/);
	await page.getByRole("button", { name: "Start the check" }).click();
	await expect(page.getByRole("button", { name: "Continue" })).toBeVisible();
	expect(hashOf(page)).toBe("#/");
});

test("a token with another version byte shows UNSUPPORTED_VERSION", async ({
	page,
}) => {
	const bytes = base64url.decode(tokenFor(DENIED));
	bytes[0] = 9;
	await openClaimCheck(page, `#/?r=${base64url.encode(bytes)}`);
	await expect(page.getByRole("heading", { level: 2 })).toBeVisible();
	await expect(page.getByRole("heading", { level: 2 })).not.toHaveText(
		/older rules|damaged/,
	);
	await expect(page.getByRole("button", { name: "Continue" })).toHaveCount(0);
});

test("Copy link copies the link and shows it", async ({ page, context }) => {
	await context.grantPermissions(["clipboard-read", "clipboard-write"]);
	await openClaimCheck(page, `#/?r=${tokenFor(DENIED)}`);
	await page.getByRole("button", { name: "Copy link to this verdict" }).click();
	await expect(page.locator("main").getByText(page.url())).toBeVisible();
	expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
		page.url(),
	);
});

test("a refused clipboard shows the link to copy by hand", async ({ page }) => {
	await page.addInitScript(() => {
		Object.defineProperty(navigator, "clipboard", {
			value: { writeText: () => Promise.reject(new Error("denied")) },
		});
	});
	await openClaimCheck(page, `#/?r=${tokenFor(DENIED)}`);
	await page.getByRole("button", { name: "Copy link to this verdict" }).click();
	const field = page.getByRole("textbox", { name: "Copy this link by hand." });
	await expect(field).toHaveValue(page.url());
});
