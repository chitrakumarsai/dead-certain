import { answerWith, questionHeading, startCheck } from "./claim-check-helpers";
import { expect, expectNoAxeViolations, test } from "./kit-fixtures";

// A full accident claim, answered in the order the engine asks.
const ACCIDENT = [
	"250000",
	"Accident",
	"Other",
	"No",
	"2000",
	"6000",
	"Five lakh",
	"5",
	"40",
	"0",
];

async function reachVerdict(page: import("@playwright/test").Page) {
	await startCheck(page);
	for (const value of ACCIDENT) await answerWith(page, value);
	await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
	await expect(page.getByRole("button", { name: "Continue" })).toHaveCount(0);
}

/** At phone widths the rail sits in the "Your answers (N)" disclosure. */
async function openRail(page: import("@playwright/test").Page) {
	const toggle = page.getByRole("button", { name: /^Your answers \(\d+\)$/ });
	if (
		(await toggle.count()) > 0 &&
		(await toggle.getAttribute("aria-expanded")) === "false"
	)
		await toggle.click();
}

test.describe("Claim Check answers rail", () => {
	test("is a margin at 1280 px and a disclosure at 390 px", async ({
		page,
	}, info) => {
		await startCheck(page);
		await answerWith(page, "250000");
		const toggle = page.getByRole("button", { name: "Your answers (1)" });
		if (info.project.name === "390") await expect(toggle).toBeVisible();
		if (info.project.name === "1280") {
			await expect(toggle).toHaveCount(0);
			await expect(page.getByRole("complementary")).toBeVisible();
		}
		await openRail(page);
		await expect(
			page.getByRole("button", {
				name: /^Change Hospital bill, currently ₹2,50,000/,
			}),
		).toBeVisible();
		await expectNoAxeViolations(page);
	});

	test("an answer opens its question filled in, marked aria-current", async ({
		page,
	}) => {
		await startCheck(page);
		await answerWith(page, "250000");
		await answerWith(page, "Accident");
		await openRail(page);
		await page
			.getByRole("button", {
				name: /^Change Cause of admission, currently Accident/,
			})
			.click();
		await expect(questionHeading(page)).toHaveText(
			/illness or for an accident/,
		);
		await expect(page.getByRole("radio", { name: "Accident" })).toBeChecked();
		await openRail(page);
		await expect(
			page.getByRole("button", { name: /^Change Cause of admission/ }),
		).toHaveAttribute("aria-current", "true");
	});

	test("a changed answer recomputes with no confirmation and says so", async ({
		page,
	}) => {
		await reachVerdict(page);
		await openRail(page);
		await page
			.getByRole("button", { name: /^Change Kind of treatment/ })
			.click();
		await answerWith(page, "Cosmetic");
		await expect(page.getByRole("button", { name: "Continue" })).toHaveCount(0);
		await expect(
			page.getByText("Kind of treatment changed. The verdict updated."),
		).toBeAttached();
		// Changing it back restores the rail entry.
		await openRail(page);
		await page
			.getByRole("button", { name: /^Change Kind of treatment/ })
			.click();
		await answerWith(page, "Other");
		await openRail(page);
		await expect(
			page.getByRole("button", {
				name: /^Change Kind of treatment, currently Other/,
			}),
		).toBeVisible();
	});

	test("a change that decides the claim moves later answers to skipped notes, and back", async ({
		page,
	}) => {
		await reachVerdict(page);
		await openRail(page);
		const before = await page.getByRole("button", { name: /^Change / }).count();
		await page
			.getByRole("button", { name: /^Change Kind of treatment/ })
			.click();
		await answerWith(page, "Cosmetic");
		await openRail(page);
		await expect(page.getByRole("button", { name: /^Change / })).toHaveCount(3);
		await expect(
			page
				.getByRole("listitem")
				.filter({
					hasText: "Not needed now that Kind of treatment is Cosmetic.",
				})
				.first(),
		).toBeVisible();
		await page
			.getByRole("button", { name: /^Change Kind of treatment/ })
			.click();
		await answerWith(page, "Other");
		await openRail(page);
		await expect(page.getByRole("button", { name: /^Change / })).toHaveCount(
			before,
		);
		await expect(
			page.getByText("Not needed now that Kind of treatment is Cosmetic."),
		).toHaveCount(0);
	});
});
