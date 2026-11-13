import { expect, expectNoAxeViolations, test } from "./kit-fixtures";

test("kit page has a clean console and no axe violations", async ({
	page,
}, testInfo) => {
	await page.goto("./kit/");
	await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

	await expectNoAxeViolations(page);
	// Evidence for the pull request. test-results/ is git-ignored.
	await page.screenshot({
		path: testInfo.outputPath("kit.png"),
		fullPage: true,
	});
});

for (const level of ["warn", "error"] as const) {
	test(`the console gate fails a test that logs console.${level}`, async ({
		page,
	}) => {
		test.fail(true, "the gate must turn this test red");
		await page.goto("./kit/");

		await page.evaluate((method) => console[method]("gate probe"), level);
	});
}

test("the reduced-motion project, and only it, reduces motion", async ({
	page,
}, testInfo) => {
	await page.goto("./kit/");

	const reduced = await page.evaluate(
		() => matchMedia("(prefers-reduced-motion: reduce)").matches,
	);

	expect(reduced).toBe(testInfo.project.name === "reduced-motion");
});

test("the skip link is the first stop and moves focus to the content", async ({
	page,
}) => {
	await page.goto("./kit/");

	await expect(page.getByRole("heading", { level: 1 })).toHaveText(
		"Component kit",
	);
	await page.keyboard.press("Tab");
	await expect(
		page.getByRole("link", { name: "Skip to the content" }),
	).toBeFocused();
	await page.keyboard.press("Enter");
	await expect(page.locator("main#content")).toBeFocused();
});

const TOKEN_SPECIMENS = [
	"tokens-colour",
	"tokens-type",
	"tokens-spacing",
	"tokens-radius",
	"tokens-motion",
];

test("every token specimen has a heading, live content and a one-line note", async ({
	page,
}) => {
	await page.goto("./kit/");

	for (const id of TOKEN_SPECIMENS) {
		const specimen = page.locator(`figure[data-specimen="${id}"]`);
		await expect(specimen, id).toHaveAttribute("id", id);
		await expect(specimen.getByRole("heading", { level: 3 }), id).toBeVisible();
		await expect(specimen.locator("figcaption"), id).not.toBeEmpty();
	}
	await expect(
		page
			.getByRole("navigation", { name: "Contents" })
			.locator('a[href^="#tokens-"]'),
	).toHaveCount(TOKEN_SPECIMENS.length);
});

for (const id of ["tokens-type", "tokens-motion"]) {
	test(`the deep link #${id} scrolls that specimen into view`, async ({
		page,
	}) => {
		await page.goto(`./kit/#${id}`);

		await expect(page.locator(`#${id}`)).toBeInViewport();
	});
}

test("paper specimens sit on the lightbox", async ({ page }) => {
	await page.goto("./kit/");

	const backdrop = await page.locator("#tokens-type").evaluate((el) => {
		let node: Element | null = el;
		while (node) {
			const colour = getComputedStyle(node).backgroundColor;
			if (colour !== "rgba(0, 0, 0, 0)") return colour;
			node = node.parentElement;
		}
		return "none";
	});

	expect(backdrop).toBe("rgb(237, 242, 243)");
});

test("colour swatches print the contrast ratio computed from the tokens", async ({
	page,
}) => {
	await page.goto("./kit/");
	const colour = page.locator("#tokens-colour");

	await expect(colour.getByText("16.05:1")).toBeVisible();
	await expect(colour.getByText("1.48:1")).toBeVisible();
	await expect(colour.getByText("Decorative only")).toBeVisible();
});

test("the type specimen shows all seven styles at their token sizes", async ({
	page,
}) => {
	await page.goto("./kit/");
	const samples = page.locator("#tokens-type [data-type-style]");

	await expect(samples).toHaveCount(7);
	await expect(
		page.locator('[data-type-style="doc-body"] p').first(),
	).toHaveCSS("font-size", "17px");
	await expect(page.locator('[data-type-style="mono"] p').first()).toHaveCSS(
		"line-height",
		"22px",
	);
});

test("motion durations replay, or are stated as text under reduced motion", async ({
	page,
}, testInfo) => {
	await page.goto("./kit/");
	const motion = page.locator("#tokens-motion");
	const replay = motion.getByRole("button", { name: "Replay 500 ms" });

	if (testInfo.project.name === "reduced-motion") {
		await expect(replay).toBeHidden();
		await expect(motion.getByText("Panels change in 0 ms")).toBeVisible();
		return;
	}
	await expect(replay).toBeVisible();
	const box = await replay.boundingBox();
	expect(box?.height).toBeGreaterThanOrEqual(44);
	await replay.click();
	await expect(replay).toHaveAttribute("aria-pressed", "true");
});

test("kit page loads the tokens: lightbox background and a token focus ring", async ({
	page,
}) => {
	await page.goto("./kit/");

	await expect(page.locator("body")).toHaveCSS(
		"background-color",
		"rgb(237, 242, 243)",
	);
	await page.keyboard.press("Tab");
	const skipLink = page.getByRole("link", { name: "Skip to the content" });
	await expect(skipLink).toHaveCSS("outline-color", "rgb(31, 111, 235)");
	await expect(skipLink).toHaveCSS("outline-width", "2px");
	await expect(skipLink).toHaveCSS("outline-offset", "2px");
});

test("kit page uses the Tailwind theme: token type and spacing classes apply", async ({
	page,
}) => {
	await page.setViewportSize({ width: 390, height: 800 });
	await page.goto("./kit/");
	const heading = page.getByRole("heading", { level: 1 });

	await expect(heading).toHaveCSS("font-size", "21px");
	await expect(heading).toHaveCSS("line-height", "28px");
	await expect(heading).toHaveCSS("font-weight", "600");

	await page.setViewportSize({ width: 768, height: 800 });
	await expect(heading).toHaveCSS("font-size", "24px");
	await expect(heading).toHaveCSS("line-height", "32px");
});

test("forced colors keeps the focus ring as an outline", async ({ page }) => {
	await page.emulateMedia({ forcedColors: "active" });
	await page.goto("./kit/");

	await page.keyboard.press("Tab");
	const skipLink = page.getByRole("link", { name: "Skip to the content" });
	await expect(skipLink).toHaveCSS("outline-style", "solid");
	await expect(skipLink).toHaveCSS("outline-width", "2px");
});

const FACES = [
	{ family: "IBM Plex Sans", weight: 400, fallback: "monospace" },
	{ family: "IBM Plex Sans", weight: 600, fallback: "monospace" },
	{ family: "IBM Plex Serif", weight: 400, fallback: "monospace" },
	{ family: "IBM Plex Serif", weight: 600, fallback: "monospace" },
	{ family: "IBM Plex Mono", weight: 400, fallback: "serif" },
];

for (const { family, weight, fallback } of FACES) {
	test(`${family} ${weight} draws the rupee sign with its own glyph`, async ({
		page,
	}) => {
		await page.goto("./kit/");

		const widths = await page.evaluate(
			async ({ family, weight, fallback }) => {
				const loaded = await document.fonts.load(
					`${weight} 48px "${family}"`,
					"\u20B9A",
				);
				const measure = (font: string) => {
					const span = document.createElement("span");
					span.style.cssText = `position:absolute;font:${weight} 48px ${font}`;
					span.textContent = "\u20B9\u20B9\u20B9\u20B9";
					document.body.append(span);
					const width = span.getBoundingClientRect().width;
					span.remove();
					return width;
				};
				return {
					loaded: loaded.length,
					plex: measure(`"${family}", ${fallback}`),
					fallback: measure(fallback),
				};
			},
			{ family, weight, fallback },
		);

		// Both subsets load: latin for "A", latin-ext for the rupee sign.
		expect(widths.loaded).toBe(2);
		// A missing glyph would fall through and match the fallback width.
		expect(widths.plex).not.toBe(widths.fallback);
	});
}

test("the three voices use IBM Plex and every font comes from this origin", async ({
	page,
}) => {
	const fontRequests: string[] = [];
	page.on("request", (request) => {
		if (request.resourceType() === "font") fontRequests.push(request.url());
	});
	await page.goto("./kit/");
	await page.evaluate(() => document.fonts.ready);

	await expect(page.getByRole("heading", { level: 1 })).toHaveCSS(
		"font-family",
		/^"IBM Plex Sans"/,
	);
	await expect(page.locator('[data-type-style="verdict"] p').first()).toHaveCSS(
		"font-family",
		/^"IBM Plex Serif"/,
	);
	await expect(page.locator('[data-type-style="mono"] p').first()).toHaveCSS(
		"font-family",
		/^"IBM Plex Mono"/,
	);
	expect(fontRequests.length).toBeGreaterThan(0);
	for (const url of fontRequests) {
		expect(new URL(url).origin).toBe("http://localhost:4173");
	}
});
