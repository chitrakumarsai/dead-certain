import type { Page } from "@playwright/test";
import { expect, expectNoAxeViolations, test } from "./kit-fixtures";
import {
	openPreflight,
	recordedReplies,
	routeGitHub,
	summary,
} from "./preflight-helpers";

type Word = "Passed" | "Failed" | "Needs your answer";
const P: Word = "Passed";
const F: Word = "Failed";
const Q: Word = "Needs your answer";

/** What each recorded repository shows, rule by rule, as recorded on 2026-11-18. */
const CASES: {
	name: string;
	state: string;
	sentence: string;
	rows: Record<string, Word>;
}[] = [
	{
		name: "dead-certain",
		state: "Not ready",
		sentence: "1 blocker and 1 warning in chitrakumarsai/dead-certain",
		rows: {
			"R-01": P,
			"R-02": P,
			"R-03": P,
			"R-04": P,
			"R-05": P,
			"R-06": P,
			"R-07": F,
			"R-08": F,
			"R-09": Q,
		},
	},
	{
		name: "dc-sample-not-ready",
		state: "Not ready",
		sentence: "3 blockers and 1 warning in chitrakumarsai/dc-sample-not-ready",
		rows: {
			"R-01": P,
			"R-02": F,
			"R-03": P,
			"R-04": F,
			"R-05": F,
			"R-06": F,
			"R-07": P,
			"R-08": P,
			"R-09": Q,
		},
	},
	{
		name: "dc-sample-warnings",
		state: "Not ready",
		sentence: "2 warnings in chitrakumarsai/dc-sample-warnings",
		rows: {
			"R-01": P,
			"R-02": P,
			"R-03": P,
			"R-04": P,
			"R-05": P,
			"R-06": F,
			"R-07": F,
			"R-08": P,
			"R-09": Q,
		},
	},
];

const row = (page: Page, rule: string) =>
	page.locator("[data-check]").filter({
		has: page.getByRole("button", {
			name: new RegExp(`rule ${rule}\\. See why$`),
		}),
	});

async function live(page: Page, name: string) {
	await routeGitHub(page, recordedReplies(name));
	await openPreflight(page, `#/report?repo=chitrakumarsai/${name}`);
	await expect(summary(page)).toBeFocused();
}

for (const c of CASES) {
	test(`${c.name}: the summary and every check, rule by rule (5.2 to 5.7)`, async ({
		page,
	}) => {
		await live(page, c.name);
		await expect(summary(page).locator("[data-state-word]")).toHaveText(
			c.state,
		);
		await expect(summary(page).locator("svg")).toHaveCount(1);
		await expect(summary(page).locator("[data-statement]")).toHaveText(
			c.sentence,
		);
		await expect(page.locator("[data-check]")).toHaveCount(9);
		for (const [rule, word] of Object.entries(c.rows)) {
			await expect(
				row(page, rule).locator("[data-check-word]"),
				rule,
			).toHaveText(word);
			await expect(row(page, rule).getByRole("button"), rule).toHaveText(rule);
		}
		await expect(page.getByText(/^Checked \d{1,2}:\d{2}/)).toBeVisible();
		await expectNoAxeViolations(page);
	});
}

test("evidence is set in the Machine voice, and a check with no collected fact shows none (5.8 to 5.10)", async ({
	page,
}) => {
	await live(page, "dc-sample-not-ready");
	const committed = row(page, "R-05").locator("[data-detail]");
	await expect(committed).toContainText(".gitignore line 2: .kiro/");
	await expect(committed).toHaveCSS("font-family", /Plex Mono/);
	await expect(row(page, "R-02").locator("[data-detail]")).toContainText(
		"GitHub detects no licence",
	);
	await expect(row(page, "R-09").locator("[data-detail]")).toHaveCount(0);
});

test("Check another repository returns to the start screen (5.13)", async ({
	page,
}) => {
	await live(page, "dc-sample-warnings");
	await page.getByRole("button", { name: "Check another repository" }).click();
	await expect(page.getByRole("heading", { level: 1 })).toHaveText(
		"Check a repository before you submit it",
	);
});

test("the report fits one printed page (5.15)", async ({
	page,
	browserName,
}, info) => {
	test.skip(
		browserName !== "chromium" || info.project.name !== "1280",
		"PDF in Chromium, once",
	);
	await live(page, "dead-certain");
	const pdf = (await page.pdf({ format: "A4" })).toString("latin1");
	expect(pdf.match(/\/Type\s*\/Page[^s]/g)?.length).toBe(1);
});

test("hostile paths render as text and run no script (5.14)", async ({
	page,
}) => {
	const replies = recordedReplies("dc-sample-warnings");
	const treeUrl = Object.keys(replies).find((u) =>
		u.includes("/git/trees/"),
	) as string;
	const tree = JSON.parse(replies[treeUrl]?.body ?? "{}") as {
		tree: { path: string; type: string }[];
	};
	tree.tree.push(
		{ path: "apps/<img src=x onerror=alert(1)>", type: "tree" },
		{ path: "apps/*[x](javascript:alert(1))*", type: "tree" },
	);
	replies[treeUrl] = {
		...(replies[treeUrl] as {
			status: number;
			headers: Record<string, string>;
			body: string;
		}),
		body: JSON.stringify(tree),
	};
	page.on("dialog", () => {
		throw new Error("a script ran");
	});
	await routeGitHub(page, replies);
	await openPreflight(page, "#/report?repo=chitrakumarsai/dc-sample-warnings");
	await expect(summary(page)).toBeFocused();
	const apps = row(page, "R-08").locator("[data-detail]");
	await expect(apps).toContainText("apps/<img src=x onerror=alert(1)>");
	await expect(apps).toContainText("apps/*[x](javascript:alert(1))*");
	await expect(page.locator("main img")).toHaveCount(0);
	await expect(page.locator("main a[href^='javascript']")).toHaveCount(0);
});
