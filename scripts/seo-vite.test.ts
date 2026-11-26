import { expect, test } from "vitest";
import { lastmods, stripOwned } from "./seo-vite.ts";

const fakeGit =
	(shallow: string, date: string) =>
	(args: string[]): string =>
		args[0] === "rev-parse" ? `${shallow}\n` : `${date}\n`;

test("lastmod is each page's last commit date in a full clone", () => {
	expect(lastmods(fakeGit("false", "2026-11-26"))).toEqual({
		home: "2026-11-26",
		claimCheck: "2026-11-26",
		preFlight: "2026-11-26",
	});
});

test("a shallow clone, a failing git or an odd date gives no lastmod (requirement 5.2)", () => {
	expect(lastmods(fakeGit("true", "2026-11-26"))).toEqual({});
	expect(
		lastmods(() => {
			throw new Error("not a git repository");
		}),
	).toEqual({});
	expect(lastmods(fakeGit("false", ""))).toEqual({});
});

test("stripOwned removes the hand-written title, description and Open Graph lines only", () => {
	const html = [
		"<head>",
		'\t\t<meta charset="utf-8" />',
		'\t\t<meta name="description" content="old" />',
		"\t\t<title>Old</title>",
		'\t\t<meta property="og:title" content="old" />',
		'\t\t<meta name="viewport" content="width=device-width, initial-scale=1" />',
		"</head>",
		"",
	].join("\n");
	expect(stripOwned(html)).toBe(
		[
			"<head>",
			'\t\t<meta charset="utf-8" />',
			'\t\t<meta name="viewport" content="width=device-width, initial-scale=1" />',
			"</head>",
			"",
		].join("\n"),
	);
});
