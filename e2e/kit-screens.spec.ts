import { expect, expectNoAxeViolations, test } from "./kit-fixtures";

const SCREENS = [
	["start", "Check a hospital claim before you file it"],
	["question", "What was the room rent per day?"],
	["verdict", "Paid in part. ₹1,42,500 of ₹2,10,000 will be paid"],
] as const;

for (const [name, heading] of SCREENS) {
	test(`the ${name} screen loads on its own with a clean console and no axe violations`, async ({
		page,
	}) => {
		await page.goto(`./kit/screen.html?screen=${name}`);

		await expect(page.getByRole("main")).toContainText(
			heading.split(". ").at(-1) ?? heading,
		);
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
