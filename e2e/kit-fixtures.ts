import { AxeBuilder } from "@axe-core/playwright";
import { test as base, expect, type Page } from "@playwright/test";

/**
 * Every kit test fails on a browser console error or warning, and on an
 * uncaught page error (requirement 28.5).
 */
export const test = base.extend<{
	consoleGate: undefined;
	/**
	 * Console messages a test expects, such as the browser's own "Failed to load
	 * resource" line for a deliberate HTTP error. Everything else still fails.
	 */
	consoleAllow: RegExp[];
}>({
	consoleAllow: [[], { option: true }],
	consoleGate: [
		async ({ page, consoleAllow }, use) => {
			const messages: string[] = [];
			page.on("console", (message) => {
				if (message.type() === "error" || message.type() === "warning") {
					const text = message.text();
					if (consoleAllow.some((re) => re.test(text))) return;
					messages.push(`${message.type()}: ${text}`);
				}
			});
			page.on("pageerror", (error) => messages.push(`pageerror: ${error}`));

			await use(undefined);

			expect(messages, "browser console must be clean").toEqual([]);
		},
		{ auto: true },
	],
	// Every load of the gallery waits until it has handed focus back to the
	// body. Before that, a test's Tab or focus() can be undone by the hand-back,
	// which made CI fail now and then on slower machines.
	page: async ({ page }, use) => {
		const goto = page.goto.bind(page);
		page.goto = async (url, options) => {
			const response = await goto(url, options);
			if (new URL(page.url()).pathname.endsWith("/kit/"))
				await waitForKit(page);
			return response;
		};
		await use(page);
	},
});

/** Zero axe violations on the page, or inside `scope` when given. */
export async function expectNoAxeViolations(
	page: Page,
	scope?: string,
): Promise<void> {
	// The framed AppShell pages each own a full set of landmarks. Read through
	// the gallery, axe would see three pages as one; kit-app-shell.spec.ts
	// and kit-screens.spec.ts check those pages on their own at every width.
	const builder = new AxeBuilder({ page }).exclude(
		'[data-specimen^="appshell-"] iframe, [data-specimen^="screen-"] iframe',
	);
	const { violations } = await (scope
		? builder.include(scope)
		: builder
	).analyze();

	expect(violations.map((v) => `${v.id}: ${v.nodes.length} node(s)`)).toEqual(
		[],
	);
}

export { expect };

/**
 * Waits until the gallery has mounted and handed focus back to the body.
 * Press Tab only after this, or the hand-back can take the focus away.
 */
export async function waitForKit(page: Page): Promise<void> {
	await expect(page.locator("body[data-kit-ready]")).toHaveCount(1);
}
