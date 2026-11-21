// @ts-expect-error TS2591: no type definitions for node:fs
import * as fs from "node:fs";
import { describe, expect, it } from "vitest";
import { realKb } from "./testing/realKb";

// Only config.ts names a fact or a goal (requirement 5.3). A name counts when it
// is quoted or read as a property: "name", 'name', `name` or .name.
const SRC = new URL("./", import.meta.url);
const files = (fs.readdirSync(SRC, { recursive: true }) as string[])
	.map((f) => f.replaceAll("\\", "/"))
	.filter((f) => /\.tsx?$/.test(f) && f !== "config.ts");

describe("names", () => {
	it("names no fact outside config.ts", () => {
		const facts = Object.keys(realKb().facts);
		const found = files.flatMap((file) => {
			const text = fs.readFileSync(new URL(file, SRC), "utf8") as string;
			return facts
				.filter((fact) => new RegExp(`["'\`.]${fact}\\b`).test(text))
				.map((fact) => `${file}: ${fact}`);
		});
		expect(found).toEqual([]);
	});
});
