import { AxeBuilder } from "@axe-core/playwright";
import { test as base, expect, type Page } from "@playwright/test";

/**
 * Every kit test fails on a browser console error or warning, and on an
 * uncaught page error (requirement 28.5).
 */
export const test = base.extend<{ consoleGate: undefined }>({
	consoleGate: [
		async ({ page }, use) => {
			const messages: string[] = [];
			page.on("console", (message) => {
				if (message.type() === "error" || message.type() === "warning") {
					messages.push(`${message.type()}: ${message.text()}`);
				}
			});
			page.on("pageerror", (error) => messages.push(`pageerror: ${error}`));

			await use(undefined);

			expect(messages, "browser console must be clean").toEqual([]);
		},
		{ auto: true },
	],
});

/** Zero axe violations on the page, or inside `scope` when given. */
export async function expectNoAxeViolations(
	page: Page,
	scope?: string,
): Promise<void> {
	// The framed AppShell pages each own a full set of landmarks. Read through
	// the gallery, axe would see three pages as one; kit-app-shell.spec.ts
	// checks the shell page on its own at every width instead.
	const builder = new AxeBuilder({ page }).exclude(
		'[data-specimen^="appshell-"] iframe',
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
