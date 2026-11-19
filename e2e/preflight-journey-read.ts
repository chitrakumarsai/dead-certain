import type { Page } from "@playwright/test";

export interface CheckFixture {
	rule: string;
	label: string;
	state: string;
	evidence: string[];
}

/** Every check row of the report, as a fixture reads it: rule, label, state word and evidence lines. */
export const readChecks = (page: Page): Promise<CheckFixture[]> =>
	page.locator("[data-check]").evaluateAll((rows) =>
		rows.map((r) => ({
			rule: r.querySelector("button")?.textContent?.trim() ?? "",
			label: r.querySelector("p")?.textContent?.trim() ?? "",
			state: r.querySelector("[data-check-word]")?.textContent?.trim() ?? "",
			evidence: (r.querySelector("[data-detail]")?.textContent ?? "")
				.split("\n")
				.filter((l) => l !== ""),
		})),
	);
