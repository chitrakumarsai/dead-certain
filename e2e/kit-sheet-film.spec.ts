import { expect, expectNoAxeViolations, test } from "./kit-fixtures";

const PAPER = "rgb(252, 254, 254)";
const HAIRLINE = "rgb(201, 213, 217)";
const FILM = "rgb(11, 28, 38)";

test("the sheet is paper with a hairline border, 4 px radius and no shadow", async ({
	page,
}, testInfo) => {
	await page.goto("./kit/#sheet-paper");
	const sheet = page
		.locator('[data-specimen="sheet-paper"] [data-surface="paper"]')
		.first();

	await expect(sheet).toHaveCSS("background-color", PAPER);
	await expect(sheet).toHaveCSS("border-top-width", "1px");
	await expect(sheet).toHaveCSS("border-top-color", HAIRLINE);
	await expect(sheet).toHaveCSS("border-radius", "4px");
	await expect(sheet).toHaveCSS("box-shadow", "none");
	const wide = (testInfo.project.use.viewport?.width ?? 0) >= 768;
	await expect(sheet).toHaveCSS("padding-left", wide ? "24px" : "16px");
	const box = await sheet.boundingBox();
	expect(box?.width).toBeLessThanOrEqual(680);
	await expectNoAxeViolations(page, '[data-specimen="sheet-paper"]');
});

test("a paper sheet inside film is paper again", async ({ page }) => {
	await page.goto("./kit/#sheet-paper");
	const inner = page.locator(
		'[data-specimen="sheet-paper"] [data-surface="film"] [data-surface="paper"]',
	);

	await expect(inner).toHaveCSS("background-color", PAPER);
	await expect(inner).toHaveCSS("color", "rgb(19, 34, 44)");
});

test("the side film is a labelled section with a focusable title and Close", async ({
	page,
}) => {
	await page.goto("./kit/#film-side");
	const specimen = page.locator('[data-specimen="film-side"]');
	const film = specimen.getByRole("region", { name: "Why" });

	await expect(film).toHaveAttribute("data-surface", "film");
	await expect(film).toHaveCSS("background-color", FILM);
	await expect(film).toHaveCSS("border-top-width", "0px");
	await expect(film).toHaveCSS("border-radius", "8px");
	await expect(film).toHaveCSS("box-shadow", "none");
	await expect(film.getByRole("heading", { name: "Why" })).toHaveAttribute(
		"tabindex",
		"-1",
	);
	await expect(page.getByRole("dialog")).toHaveCount(0);
	await expectNoAxeViolations(page, '[data-specimen="film-side"]');

	await film.getByRole("button", { name: "Close" }).click();
	await expect(film).toHaveCount(0);
	await specimen.getByRole("button", { name: "Open the film" }).click();
	await expect(specimen.getByRole("region", { name: "Why" })).toBeVisible();
});

test("the sheet film is a bottom dialog that traps focus and closes on Escape", async ({
	page,
}) => {
	await page.goto("./kit/#film-sheet");
	const opener = page
		.locator('[data-specimen="film-sheet"]')
		.getByRole("button", { name: "Open the film sheet" });

	await opener.click();
	const dialog = page.getByRole("dialog", { name: "Why" });
	await expect(dialog).toBeVisible();
	await expect(dialog).toHaveAttribute("data-surface", "film");
	await expect(dialog.getByRole("heading", { name: "Why" })).toBeFocused();

	for (let i = 0; i < 6; i++) {
		await page.keyboard.press("Tab");
		const inside = await dialog.evaluate((el) =>
			el.contains(document.activeElement),
		);
		expect(inside, `focus stays in the film after ${i + 1} Tab presses`).toBe(
			true,
		);
	}

	const viewport = page.viewportSize();
	const box = await dialog.boundingBox();
	expect(Math.round((box?.y ?? 0) + (box?.height ?? 0))).toBe(viewport?.height);
	expect(box?.height ?? 0).toBeLessThanOrEqual(
		(viewport?.height ?? 0) * 0.85 + 1,
	);
	await expect(dialog).toHaveCSS("overflow-y", "auto");
	await expect(dialog).toHaveCSS("box-shadow", "none");
	const scrim = page.locator("[data-film-scrim]");
	await expect(scrim).toHaveCSS("background-image", "none");
	await expect(scrim).toHaveCSS("background-color", /^(oklab|rgba|color)\(/);
	await expectNoAxeViolations(page);

	await page.keyboard.press("Escape");
	await expect(dialog).toHaveCount(0);
	await expect(opener).toBeFocused();
});

test("the film keeps its content mounted when it flips between side and sheet", async ({
	page,
}) => {
	await page.setViewportSize({ width: 1280, height: 900 });
	await page.goto("./kit/#film-responsive");
	const specimen = page.locator('[data-specimen="film-responsive"]');
	await specimen
		.getByRole("button", { name: "Open the responsive film" })
		.click();

	const probe = page.locator("[data-film-probe]");
	await expect(probe).toHaveText("Mounted 1 time");
	await expect(page.getByRole("dialog")).toHaveCount(0);
	await probe.evaluate((el) => {
		(window as unknown as { probeNode: Element }).probeNode = el;
	});

	await page.setViewportSize({ width: 1279, height: 900 });
	await expect(page.getByRole("dialog", { name: "Why" })).toBeVisible();
	await expect(probe).toHaveText("Mounted 1 time");
	expect(
		await probe.evaluate(
			(el) => (window as unknown as { probeNode: Element }).probeNode === el,
		),
	).toBe(true);

	await page.setViewportSize({ width: 1280, height: 900 });
	await expect(page.getByRole("dialog")).toHaveCount(0);
	await expect(probe).toHaveText("Mounted 1 time");
	expect(
		await probe.evaluate(
			(el) => (window as unknown as { probeNode: Element }).probeNode === el,
		),
	).toBe(true);
});
