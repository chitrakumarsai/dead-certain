import { expect, expectNoAxeViolations, test } from "./kit-fixtures";

const SCREENS = [
	["start", "Check a hospital claim before you file it"],
	["question", "What was the room rent per day?"],
	["verdict", "Paid in part. ₹1,42,500 of ₹2,10,000 will be paid"],
	["xray", "Why: Room rent above the limit"],
	["preflight", "2 checks failed and 1 needs your answer in owner/name"],
	["stale", "This link was made with older rules"],
] as const;

for (const [name, heading] of SCREENS) {
	test(`the ${name} screen loads on its own with a clean console and no axe violations`, async ({
		page,
	}) => {
		await page.goto(`./kit/screen.html?screen=${name}`);

		await expect(
			page.getByText(heading.split(". ").at(-1) ?? heading).first(),
		).toBeVisible();
		await expectNoAxeViolations(page);
	});
}

test("the verdict screen's heading is focusable and takes focus", async ({
	page,
}) => {
	await page.goto("./kit/screen.html?screen=verdict");
	const heading = page.getByRole("heading", { level: 1 });

	await expect(heading).toHaveAccessibleName(SCREENS[2][1]);
	await expect(heading).toHaveAttribute("tabindex", "-1");
	await expect(heading).toBeFocused();
});

test("the gallery frames each screen and links to it", async ({ page }) => {
	await page.goto("./kit/#screen-start");

	for (const [name] of SCREENS) {
		const specimen = page.locator(`[data-specimen="screen-${name}"]`);
		await expect(specimen.locator("iframe"), name).toHaveAttribute(
			"src",
			`./screen.html?screen=${name}&preview=1`,
		);
		await expect(specimen.locator("iframe")).toHaveAttribute("inert", "");
		await expect(
			specimen.getByRole("link", { name: /on its own$/ }),
		).toHaveAttribute("href", `./screen.html?screen=${name}`);
	}
});

test("the X-ray screen opens the film beside the sheet from 1280 px, as a bottom sheet below", async ({
	page,
}) => {
	await page.goto("./kit/screen.html?screen=xray");
	const isWide = (page.viewportSize()?.width ?? 0) >= 1280;

	await expect(
		page.getByRole("heading", { name: "Why: Room rent above the limit" }),
	).toBeFocused();
	// After the develop (the line hides when it ends; reduced motion has none),
	// nothing is left past the page's right edge.
	const line = page.locator("[data-scan-line]");
	if ((await line.count()) > 0) await expect(line).toHaveClass(/\binvisible\b/);
	const overflow = await page.evaluate(
		() => document.documentElement.scrollWidth - innerWidth,
	);
	expect(overflow).toBeLessThanOrEqual(0);
	if (isWide) {
		await expect(page.getByRole("dialog")).toHaveCount(0);
		await expect(page.locator("[data-xray-stage]")).toHaveAttribute(
			"data-film",
			"side",
		);
	} else {
		await expect(
			page.getByRole("dialog", { name: "Why: Room rent above the limit" }),
		).toBeVisible();
	}
});

test("the Pre-Flight report groups checks by clause number, in order, and asks inline", async ({
	page,
}) => {
	await page.goto("./kit/screen.html?screen=preflight");

	await expect(page.locator("[data-group]")).toHaveCount(3);
	expect(
		await page
			.locator("[data-group]")
			.evaluateAll((groups) => groups.map((g) => g.getAttribute("data-group"))),
	).toEqual(["1", "2", "4"]);
	await expect(page.getByRole("heading", { level: 2 })).toHaveText([
		"Repository",
		"Kiro usage",
		"Submission",
	]);
	// The question sits on the one check whose input it asks for.
	await expect(
		page.getByText("Is the demo video under 3 minutes?"),
	).toHaveCount(1);
	await expect(
		page
			.locator('[data-check="unknown"]')
			.filter({ hasText: "Demo video under 3 minutes" })
			.getByText("Is the demo video under 3 minutes?"),
	).toBeVisible();
	await expect(page.getByRole("radio", { name: "Yes" })).toBeVisible();
});
