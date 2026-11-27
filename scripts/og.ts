// pnpm og (seo requirement 7): builds the site, previews it on a free port, and
// screenshots kit/og.html into the three OG images, the four icon files and
// og.json under apps/site/public/. Run it by hand and commit what it writes;
// it is not part of pnpm build. Runs under Node 22 with --experimental-strip-types.
// @ts-expect-error TS2591: no type definitions for node:child_process
import { execFileSync, spawn } from "node:child_process";
// @ts-expect-error TS2591: no type definitions for node:fs
import { mkdirSync, writeFileSync } from "node:fs";
// @ts-expect-error TS2591: no type definitions for node:net
import { createServer } from "node:net";
import { chromium, type Page } from "@playwright/test";
import { icoFromPng, pngSize } from "./og-files.ts";

const ROOT = new URL("../", import.meta.url);
const PUBLIC = new URL("apps/site/public/", ROOT);
const OG_MAX_BYTES = 200_000;
const IMAGES = ["home", "claimCheck", "preFlight"] as const;
const ICONS: [string, number][] = [
	["icon-512.png", 512],
	["icon-192.png", 192],
	["apple-touch-icon.png", 180],
];
const FAVICON_PX = 32;

type Entries = Record<
	(typeof IMAGES)[number],
	{ file: string; alt: string; text: string[] }
>;

const freePort = (): Promise<number> =>
	new Promise((resolve, reject) => {
		const server = createServer();
		server.once("error", reject);
		server.listen(0, () => {
			const { port } = server.address() as { port: number };
			server.close(() => resolve(port));
		});
	});

async function waitFor(url: string): Promise<void> {
	for (let i = 0; i < 100; i++) {
		try {
			if ((await fetch(url)).ok) return;
		} catch {
			// Not up yet.
		}
		await new Promise((r) => setTimeout(r, 200));
	}
	throw new Error(`The preview did not start at ${url}`);
}

/** Opens one scene and waits for its fonts, so no fallback face is captured. */
async function open(
	page: Page,
	url: string,
	errors: readonly string[],
): Promise<void> {
	await page.goto(url);
	await page
		.locator("[data-og-frame]")
		.waitFor({ timeout: 10_000 })
		.catch(() => {
			throw new Error(
				`${url} drew no frame: ${errors.join("; ") || "no error"}`,
			);
		});
	if (errors.length > 0) throw new Error(`${url}: ${errors.join("; ")}`);
	await page.evaluate(() => document.fonts.ready.then(() => undefined));
	// VerdictHeadline focuses itself on mount; a picture shows no focus ring.
	await page.evaluate(() =>
		(document.activeElement as HTMLElement | null)?.blur(),
	);
}

function write(name: string, bytes: Uint8Array, width: number, height: number) {
	const size = pngSize(bytes);
	if (size.width !== width || size.height !== height)
		throw new Error(
			`${name} is ${size.width}x${size.height}, not ${width}x${height}`,
		);
	writeFileSync(new URL(name, PUBLIC), bytes);
}

async function render(base: string): Promise<void> {
	const browser = await chromium.launch();
	try {
		const context = await browser.newContext({
			viewport: { width: 1200, height: 630 },
			deviceScaleFactor: 1,
			colorScheme: "dark",
		});
		await context.addInitScript(() => localStorage.setItem("dc-theme", "dark"));
		const page = await context.newPage();
		const errors: string[] = [];
		page.on("pageerror", (e) => errors.push(e.message));
		page.on("console", (m) => {
			if (m.type() === "error") errors.push(m.text());
		});
		mkdirSync(new URL("og/", PUBLIC), { recursive: true });
		let entries: Entries | undefined;
		for (const key of IMAGES) {
			await open(page, `${base}kit/og.html?image=${key}`, errors);
			entries = (await page.evaluate("window.ogEntries")) as Entries;
			const frame = page.locator("[data-og-frame]");
			const shown = (await frame.textContent()) ?? "";
			for (const text of entries[key].text)
				if (!shown.includes(text))
					throw new Error(`The ${key} image does not show "${text}"`);
			const png = await frame.screenshot({ type: "png" });
			if (png.length > OG_MAX_BYTES)
				throw new Error(`${entries[key].file} is ${png.length} bytes`);
			write(entries[key].file, png, 1200, 630);
		}
		for (const [name, size] of [...ICONS, ["favicon", FAVICON_PX] as const]) {
			await page.setViewportSize({ width: size, height: size });
			await open(page, `${base}kit/og.html?image=icon&size=${size}`, errors);
			const png = await page
				.locator("[data-og-frame]")
				.screenshot({ type: "png" });
			if (name === "favicon") {
				pngSize(png);
				writeFileSync(new URL("favicon.ico", PUBLIC), icoFromPng(png, size));
			} else write(name, png, size, size);
		}
		writeFileSync(
			new URL("og/og.json", PUBLIC),
			`${JSON.stringify(entries, null, "\t")}\n`,
		);
	} finally {
		await browser.close();
	}
}

async function main(): Promise<void> {
	const cwd = new URL(".", ROOT).pathname;
	execFileSync("pnpm", ["--filter", "@dead-certain/site", "build"], {
		cwd,
		stdio: "inherit",
	});
	const port = await freePort();
	const preview = spawn(
		"pnpm",
		[
			"--filter",
			"@dead-certain/site",
			"exec",
			"vite",
			"preview",
			"--port",
			String(port),
			"--strictPort",
		],
		{ cwd, stdio: "ignore", detached: true },
	);
	const base = `http://localhost:${port}/dead-certain/`;
	try {
		await waitFor(base);
		await render(base);
		console.log(
			"pnpm og: wrote the OG images, icons and og.json under apps/site/public/. Commit them.",
		);
	} finally {
		// The whole group: pnpm, then vite under it.
		(
			globalThis as unknown as { process: { kill(pid: number): void } }
		).process.kill(-preview.pid);
	}
}

await main();
