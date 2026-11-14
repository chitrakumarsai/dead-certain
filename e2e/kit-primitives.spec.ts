import { expect, expectNoAxeViolations, test } from "./kit-fixtures";

const ICON_NAMES = [
	"CheckCircle",
	"MinusCircle",
	"CrossCircle",
	"QuestionCircle",
	"InfoCircle",
	"Chevron",
	"Close",
	"Menu",
];

for (const surface of ["paper", "film"] as const) {
	test(`icons on ${surface}: eight inline SVGs, hidden from assistive technology`, async ({
		page,
	}) => {
		await page.goto(`./kit/#icons-${surface}`);
		const specimen = page.locator(`[data-specimen="icons-${surface}"]`);
		const icons = specimen.locator("svg");

		await expect(icons).toHaveCount(ICON_NAMES.length);
		for (const name of ICON_NAMES) {
			await expect(specimen.getByText(name, { exact: true })).toBeVisible();
		}
		for (const icon of await icons.all()) {
			await expect(icon).toHaveAttribute("aria-hidden", "true");
			await expect(icon).toHaveAttribute("viewBox", "0 0 24 24");
			await expect(icon).toHaveAttribute("stroke-width", "2");
			await expect(icon).toHaveAttribute("stroke", "currentColor");
			const box = await icon.boundingBox();
			expect(box?.width).toBe(24);
			expect(box?.height).toBe(24);
		}
		await expectNoAxeViolations(page, `[data-specimen="icons-${surface}"]`);
	});
}

test("film icons sit on film and draw in bone", async ({ page }) => {
	await page.goto("./kit/#icons-film");
	const film = page.locator(
		'[data-specimen="icons-film"] [data-surface="film"]',
	);

	await expect(film).toHaveCSS("background-color", "rgb(11, 28, 38)");
	await expect(film.locator("svg").first()).toHaveCSS(
		"color",
		"rgb(220, 232, 235)",
	);
});

test("the page has exactly one polite live region, and announcing fills it", async ({
	page,
}) => {
	await page.goto("./kit/#a11y-announce");
	const region = page.locator("[aria-live]");

	await expect(region).toHaveCount(1);
	await expect(region).toHaveAttribute("aria-live", "polite");
	await expect(region).toBeEmpty();

	const announce = page.getByRole("button", {
		name: "Announce a sample message",
	});
	await announce.click();
	await expect(region).toHaveText("Question 3. Up to 6 more.");

	// The same message twice is still announced: the region is refilled.
	await announce.click();
	await expect(region).toHaveText("Question 3. Up to 6 more.");
});

test("a heading that mounts takes focus, and again when its key changes", async ({
	page,
}) => {
	await page.goto("./kit/#a11y-focus");
	// Question cards elsewhere on the page use the same question text.
	const focusSpecimen = page.locator('[data-specimen="a11y-focus"]');
	const next = page.getByRole("button", { name: "Show the next question" });

	await next.click();
	await expect(
		focusSpecimen.getByRole("heading", {
			name: "What was the room rent per day?",
		}),
	).toBeFocused();

	await next.click();
	await expect(
		focusSpecimen.getByRole("heading", {
			name: "What is the sum insured on the policy?",
		}),
	).toBeFocused();
});
