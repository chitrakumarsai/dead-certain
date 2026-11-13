import { expect, test } from "vitest";
import site from "../../../apps/site/package.json";
import ui from "../package.json";

// Exact versions only (requirement 29.3). workspace:* is the one allowed protocol.
const EXACT = /^(\d+\.\d+\.\d+(-[\w.]+)?|workspace:\*)$/;

function unpinned(pkg: object): string[] {
	const { dependencies = {}, devDependencies = {} } = pkg as {
		dependencies?: Record<string, string>;
		devDependencies?: Record<string, string>;
	};
	return Object.entries({ ...dependencies, ...devDependencies })
		.filter(([, version]) => !EXACT.test(version))
		.map(([name, version]) => `${name}@${version}`);
}

test("flags ranges and tags, accepts exact versions and workspace:*", () => {
	const sample = {
		dependencies: { a: "^1.0.0", b: "~1.0.0", c: "latest", d: "1.2.3" },
		devDependencies: { e: "workspace:*", f: "1.x" },
	};

	expect(unpinned(sample)).toEqual([
		"a@^1.0.0",
		"b@~1.0.0",
		"c@latest",
		"f@1.x",
	]);
});

test("packages/ui pins every dependency to an exact version", () => {
	expect(unpinned(ui)).toEqual([]);
});

test("apps/site pins every dependency to an exact version", () => {
	expect(unpinned(site)).toEqual([]);
});
