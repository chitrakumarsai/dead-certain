// Every Claim Check screen, reached through the interface, for the sweeps of task 15.
import type { FactValue } from "@dead-certain/engine";
import type { Page } from "@playwright/test";
import { answerInUi, REDUCED, reducedToken } from "./claim-check-engine";
import {
	openClaimCheck,
	questionHeading,
	startCheck,
} from "./claim-check-helpers";
import { expect } from "./kit-fixtures";

/** An illness, so the date questions are asked too. */
const ILLNESS: Record<string, FactValue> = {
	...REDUCED,
	cause: "illness",
	policy_start_date: "2025-01-01",
	illness_start_date: "2025-06-01",
};

/** Opens the check and answers until the app asks `fact`. */
const questionFor = (fact: string) => async (page: Page) => {
	await startCheck(page);
	await answerInUi(page, ILLNESS, fact);
	await expect(questionHeading(page)).toBeFocused();
};

async function verdict(page: Page) {
	await openClaimCheck(page, `#/?r=${reducedToken}`);
	await expect(page.getByRole("table")).toBeVisible();
}

export const SCREENS: { name: string; open: (page: Page) => Promise<void> }[] =
	[
		{
			name: "start",
			open: async (page) => {
				await openClaimCheck(page);
				await expect(
					page.getByRole("button", { name: "Start the check" }),
				).toBeVisible();
			},
		},
		{ name: "money question", open: questionFor("claimed") },
		{ name: "enum question", open: questionFor("cause") },
		{ name: "boolean question", open: questionFor("treated_outside_india") },
		{ name: "date question", open: questionFor("policy_start_date") },
		{ name: "number question", open: questionFor("room_days") },
		{ name: "verdict", open: verdict },
		{
			name: "x-ray",
			open: async (page) => {
				await verdict(page);
				await page
					.getByRole("button", { name: "See why", exact: true })
					.click();
				await expect(page.getByRole("tree", { name: "Proof" })).toBeVisible();
			},
		},
		{
			name: "rulebook",
			open: async (page) => {
				await openClaimCheck(page, "#/rulebook");
				await expect(page.getByRole("heading", { level: 1 })).toBeFocused();
			},
		},
		{
			name: "stale link",
			open: async (page) => {
				await openClaimCheck(page, "#/?r=not-a-token");
				await expect(
					page.getByRole("button", { name: "Start the check" }),
				).toBeVisible();
			},
		},
		{
			name: "404",
			open: async (page) => {
				await openClaimCheck(page, "#/nowhere");
				await expect(page.getByRole("heading", { level: 1 })).toBeFocused();
			},
		},
	];
