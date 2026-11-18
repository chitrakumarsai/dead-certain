// @ts-expect-error TS2591: no type definitions for node:fs
import { readdirSync, readFileSync, statSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { KEPT_HEADERS, looksLikeCredential, TARGETS } from "./record";

const ROOT = new URL("./recorded/", import.meta.url);
const STEPS = ["metadata", "tree", "gitignore", "readme"];

/** Every JSON file under recorded/, as [relative path, parsed content]. */
function recordedFiles(): [string, Record<string, unknown>][] {
	return (readdirSync(ROOT) as string[])
		.filter((dir) => statSync(new URL(dir, ROOT)).isDirectory())
		.flatMap((dir) =>
			(readdirSync(new URL(`${dir}/`, ROOT)) as string[])
				.filter((f) => f.endsWith(".json"))
				.map((f): [string, Record<string, unknown>] => [
					`${dir}/${f}`,
					JSON.parse(
						readFileSync(new URL(`${dir}/${f}`, ROOT), "utf8") as string,
					),
				]),
		);
}

describe("recorded responses", () => {
	const files = recordedFiles();

	it("hold the four steps for each of the three targets", () => {
		for (const target of TARGETS)
			for (const step of STEPS)
				expect(
					files.some(
						([path]) => path === `${target.replace("/", "__")}/${step}.json`,
					),
					`${target} ${step}`,
				).toBe(true);
	});

	it("each have url, status, headers and body, and only the kept headers", () => {
		for (const [path, data] of files) {
			for (const key of ["url", "status", "headers", "body"])
				expect(data, `${path} ${key}`).toHaveProperty(key);
			const headers = Object.keys(data.headers as object);
			expect(
				headers.filter((h) => !(KEPT_HEADERS as readonly string[]).includes(h)),
				path,
			).toEqual([]);
			expect(headers, path).not.toContain("authorization");
			expect(headers, path).not.toContain("set-cookie");
			expect(looksLikeCredential(JSON.stringify(data.body)), path).toBe(false);
		}
	});

	it("mark every synthetic fixture, and no real recording", () => {
		for (const [path, data] of files)
			expect(data.synthetic === true, path).toBe(path.startsWith("synthetic/"));
		expect(
			files.filter(([p]) => p.startsWith("synthetic/")).length,
		).toBeGreaterThanOrEqual(7);
	});
});

describe("looksLikeCredential", () => {
	it("catches a token with a long value, and not the word alone", () => {
		expect(
			looksLikeCredential('"token": "ghp_abcdefghijklmnopqrstuvwxyz0123"'),
		).toBe(true);
		expect(looksLikeCredential("token=short")).toBe(false);
		expect(looksLikeCredential("The token of the policy")).toBe(false);
	});
});
