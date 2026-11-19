import type { Page, Route } from "@playwright/test";
import { expect, test } from "./kit-fixtures";
import {
	GITHUB_CORS,
	openPreflight,
	recordedReplies,
	summary,
} from "./preflight-helpers";

const REPLIES = recordedReplies("dead-certain");
const status = (page: Page, step: string) =>
	page.locator(`[data-step=${step}]`);

/** Holds every GitHub request until the test releases it, in order. */
async function holdGitHub(
	page: Page,
	override: (
		url: string,
	) =>
		| { status: number; body: string; headers?: Record<string, string> }
		| undefined = () => undefined,
) {
	const held: Route[] = [];
	await page.route("https://api.github.com/**", (route) => {
		held.push(route);
	});
	const release = async () => {
		await expect.poll(() => held.length).toBeGreaterThan(0);
		const route = held.shift() as Route;
		const url = route.request().url();
		const reply = override(url) ?? REPLIES[url];
		if (reply === undefined) throw new Error(`no reply for ${url}`);
		await route.fulfill({
			status: reply.status,
			headers: { ...(reply.headers ?? {}), ...GITHUB_CORS },
			body: reply.body,
		});
	};
	return { held, release };
}

test("each step waits, reads only once its request is sent, and finishes only on its response (4.1, 4.2)", async ({
	page,
}) => {
	const { held, release } = await holdGitHub(page);
	await openPreflight(page, "#/report?repo=chitrakumarsai/dead-certain");
	await expect(
		page.getByRole("list", { name: "Collection steps" }).getByRole("listitem"),
	).toHaveText([
		/^Read repository details/,
		/^Read file tree/,
		/^Read \.gitignore/,
		/^Read README/,
	]);
	await expect.poll(() => held.length).toBe(1);
	await expect(status(page, "metadata")).toContainText("Reading");
	await expect(status(page, "tree")).toContainText("Waiting");
	await release();
	await expect(status(page, "metadata")).toContainText("Done");
	await expect(status(page, "tree")).toContainText("Reading");
	await expect(status(page, "gitignore")).toContainText("Waiting");
	await release();
	await expect(status(page, "tree")).toContainText("Done");
	await expect(status(page, "gitignore")).toContainText("Reading");
	await release();
	await expect(status(page, "readme")).toContainText("Reading");
	await expect(page.getByRole("progressbar")).toHaveCount(0);
	await expect(page.locator("main")).not.toContainText("%");
	await release();
	await expect(summary(page)).toBeFocused();
});

test.describe("after a failure", () => {
	// The browser logs its own line for the deliberate HTTP 500.
	test.use({
		consoleAllow: [
			/^Failed to load resource: the server responded with a status of 500/,
		],
	});

	test("after a failure the later steps read Not run (4.5)", async ({
		page,
	}) => {
		const { release } = await holdGitHub(page, (url) =>
			url.includes("/git/trees/")
				? {
						status: 500,
						body: "{}",
						headers: { "content-type": "application/json" },
					}
				: undefined,
		);
		await openPreflight(page, "#/report?repo=chitrakumarsai/dead-certain");
		await release();
		await release();
		await expect(status(page, "tree")).toContainText("Failed");
		await expect(status(page, "gitignore")).toContainText("Not run");
		await expect(status(page, "readme")).toContainText("Not run");
		await expect(
			page.getByRole("heading", {
				name: "GitHub sent a response Pre-Flight could not read. Try again later.",
			}),
		).toBeFocused();
	});
});

test("nothing in the steps moves under reduced motion (4.7)", async ({
	page,
}, info) => {
	test.skip(
		info.project.name !== "reduced-motion",
		"reduced-motion project only",
	);
	await holdGitHub(page);
	await openPreflight(page, "#/report?repo=chitrakumarsai/dead-certain");
	const moving = await page.locator("[data-steps], [data-steps] *").evaluateAll(
		(els) =>
			els.filter((el) => {
				const s = getComputedStyle(el);
				return (
					s.animationName !== "none" ||
					(s.transitionDuration !== "0s" && s.transitionProperty !== "none")
				);
			}).length,
	);
	expect(moving).toBe(0);
});

test("a sample shows the snapshot line and no steps (4.8)", async ({
	page,
}) => {
	await openPreflight(page, "#/report?sample=dc-sample-not-ready");
	await expect(
		page.getByText(
			/^Using a snapshot of chitrakumarsai\/dc-sample-not-ready taken /,
		),
	).toBeVisible();
	await expect(page.locator("[data-steps]")).toHaveCount(0);
});

test("the report replaces the steps with layout shift below 0.05 (11.8)", async ({
	page,
}) => {
	await page.addInitScript(() => {
		const w = window as unknown as { __cls: number };
		w.__cls = 0;
		new PerformanceObserver((list) => {
			for (const e of list.getEntries() as unknown as {
				value: number;
				hadRecentInput: boolean;
			}[])
				if (!e.hadRecentInput) w.__cls += e.value;
		}).observe({ type: "layout-shift", buffered: true });
	});
	const { release } = await holdGitHub(page);
	await openPreflight(page, "#/report?repo=chitrakumarsai/dead-certain");
	for (let i = 0; i < 4; i++) await release();
	await expect(summary(page)).toBeVisible();
	await page.evaluate(() => document.fonts.ready);
	expect(
		await page.evaluate(() => (window as unknown as { __cls: number }).__cls),
	).toBeLessThan(0.05);
});
