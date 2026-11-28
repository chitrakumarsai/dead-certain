// @ts-expect-error TS2591: no type definitions for node:fs
import { readdirSync, readFileSync } from "node:fs";
import { expect, test } from "vitest";

// Requirement 39: the reset theme compiles only the spacing keys it defines,
// so a step off the scale (pt-10) silently produces no CSS.
const theme: string = readFileSync(
	new URL("../theme.css", import.meta.url),
	"utf8",
);
const SCALE = new Set(
	[...theme.matchAll(/--spacing-([\w.]+)\s*:/g)].map((m) => m[1] as string),
);

// A numeric step on a spacing utility, after any variant prefix (md:, hover:, max-md:)
// and an optional negative sign. Named sizes (touch, column) and brackets never match.
const UTILITY =
	/(?<![\w-])((?:[\w-]+:)*-?(?:space-[xy]|gap-[xy]|inset|top|right|bottom|left|size|p[xytrbl]?|m[xytrbl]?|gap|w|h)-(\d+(?:\.\d+)?))(?![\w./-])/g;

function offScale(source: string): string[] {
	return [...source.matchAll(UTILITY)]
		.filter((m) => !SCALE.has(m[2] as string))
		.map((m) => m[1] as string);
}

// Removed by claim-check-app task 18 and pre-flight-app task 23, which fix these lines.
const ALLOWED = new Set(["apps/pre-flight/src/screens/Start.tsx: md:pt-20"]);

const ROOTS = [
	"packages/ui/src/",
	...(readdirSync(new URL("../../../apps/", import.meta.url)) as string[]).map(
		(app) => `apps/${app}/src/`,
	),
];

test("the scale is the reset theme's ten numeric keys", () => {
	const numeric = [...SCALE].filter((key) => /^\d/.test(key));
	expect(numeric.sort((a, b) => Number(a) - Number(b))).toEqual([
		"0",
		"1",
		"2",
		"3",
		"4",
		"6",
		"8",
		"12",
		"16",
		"24",
	]);
});

test("the scan catches steps off the scale and passes steps on it", () => {
	expect(
		offScale(`className="mx-auto pt-10 md:pt-20" <p className="px-5 pb-4">`),
	).toEqual(["pt-10", "md:pt-20", "px-5"]);
	expect(offScale("hover:-mt-7 gap-x-5 space-y-10 size-9 w-0.5")).toEqual([
		"hover:-mt-7",
		"gap-x-5",
		"space-y-10",
		"size-9",
		"w-0.5",
	]);
	expect(
		offScale(
			"pt-8 md:pt-16 -mt-4 size-touch max-w-column min-h-touch w-1/2 p-[3px] gap-x-4 section-10",
		),
	).toEqual([]);
});

test("no source uses a spacing step off the scale", () => {
	const repo = new URL("../../../", import.meta.url);
	const offenders = ROOTS.flatMap((root) =>
		(readdirSync(new URL(root, repo), { recursive: true }) as string[])
			.filter((file) => /\.tsx?$/.test(file) && !/\.test\.tsx?$/.test(file))
			.flatMap((file) =>
				offScale(readFileSync(new URL(root + file, repo), "utf8")).map(
					(utility) => `${root}${file}: ${utility}`,
				),
			),
	).filter((entry) => !ALLOWED.has(entry));

	expect(offenders).toEqual([]);
});
