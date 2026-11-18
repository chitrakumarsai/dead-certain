import { SCREENS } from "./claim-check-screens";
import { expect, test } from "./kit-fixtures";

// The copy rules and the refused patterns, on every screen (13.5, 13.6, 6.10).
for (const screen of SCREENS) {
	test(`${screen.name}: none of the refused patterns`, async ({ page }) => {
		await screen.open(page);
		const found = await page.evaluate(() => {
			const out: string[] = [];
			const text = document.body.textContent;
			if (text.includes("!")) out.push("an exclamation mark");
			const sorry = /\b(sorry|apologi[sz]e|unfortunately|oops)\b/i.exec(text);
			if (sorry) out.push(`an apology: "${sorry[0]}"`);
			for (const b of document.querySelectorAll("button, [role=button]"))
				if (/[←→↑↓⟵⟶⇐⇒»«›‹]/.test(b.textContent ?? ""))
					out.push(`an arrow in "${b.textContent?.trim()}"`);
			for (const el of document.querySelectorAll<HTMLElement>("body *")) {
				const s = getComputedStyle(el);
				const name = `${el.tagName.toLowerCase()} "${(el.textContent ?? "").trim().slice(0, 30)}"`;
				if (s.textTransform === "uppercase") out.push(`uppercase ${name}`);
				// The focus ring is an outline; a shadow on the focused element is still refused.
				if (s.boxShadow !== "none") out.push(`a shadow on ${name}`);
				if (s.backgroundImage.includes("gradient"))
					out.push(`a gradient on ${name}`);
			}
			return out;
		});
		expect(found).toEqual([]);
	});
}
