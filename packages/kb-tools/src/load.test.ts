import { describe, expect, it } from "vitest";
import { type Host, HostError, loadText, readKbFile } from "./index";
import { MAX_FILE_BYTES } from "./limits";

const FILE = "apps/demo/kb/demo.yaml";

function codes(text: string): string[] {
	return loadText(text, FILE).diagnostics.map((d) => d.code);
}

function hostReturning(bytes: Uint8Array): Host {
	return {
		readFile: () => bytes,
		readDir: () => [],
		stat: () => "file",
		writeFile: () => {},
		makeDir: () => {},
		cwd: () => "/",
	};
}

function hostFailing(reason: string): Host {
	return {
		...hostReturning(new Uint8Array()),
		readFile: () => {
			throw new HostError(reason);
		},
	};
}

describe("Loader: YAML syntax", () => {
	it("reports line and column for malformed YAML", () => {
		const result = loadText("id: demo\nfacts: [unclosed\n", FILE);
		expect(result.ok).toBe(false);
		const [first] = result.diagnostics;
		expect(first?.code).toBe("YAML_SYNTAX");
		expect(first?.file).toBe(FILE);
		expect(first?.message).toMatch(/line \d+, column \d+/);
	});

	it("returns a Raw_KB for well-formed YAML", () => {
		const result = loadText("id: demo\ngoals: [a]\n", FILE);
		expect(result.ok).toBe(true);
		if (result.ok) expect(result.raw).toEqual({ id: "demo", goals: ["a"] });
	});
});

describe("Loader: duplicate keys", () => {
	it("reports DUPLICATE_FACT for a repeated key in facts", () => {
		const result = loadText(
			"facts:\n  rent:\n    type: money\n  rent:\n    type: number\n",
			FILE,
		);
		expect(result.ok).toBe(false);
		expect(result.diagnostics).toHaveLength(1);
		expect(result.diagnostics[0]?.code).toBe("DUPLICATE_FACT");
		expect(result.diagnostics[0]?.id).toBe("rent");
	});

	it("reports DUPLICATE_CLAUSE for a repeated key in clauses", () => {
		const result = loadText(
			'clauses:\n  "4.2":\n    title: A\n  "4.2":\n    title: B\n',
			FILE,
		);
		expect(result.diagnostics).toHaveLength(1);
		expect(result.diagnostics[0]?.code).toBe("DUPLICATE_CLAUSE");
		expect(result.diagnostics[0]?.id).toBe("4.2");
	});

	it("reports YAML_SYNTAX for a repeated key in any other mapping", () => {
		expect(codes("id: a\nid: b\n")).toEqual(["YAML_SYNTAX"]);
		expect(
			codes("facts:\n  rent:\n    type: money\n    type: number\n"),
		).toEqual(["YAML_SYNTAX"]);
	});

	it("reports one diagnostic for each repeated key", () => {
		expect(codes("a: 1\na: 2\nb: 1\nb: 2\n")).toEqual([
			"YAML_SYNTAX",
			"YAML_SYNTAX",
		]);
	});
});

describe("Loader: document shape", () => {
	it.each([
		["empty document", ""],
		["comment only", "# nothing\n"],
		["list", "- a\n- b\n"],
		["scalar", "hello\n"],
	])("rejects %s with SCHEMA_INVALID", (_name, text) => {
		const result = loadText(text, FILE);
		expect(result.ok).toBe(false);
		expect(result.diagnostics.map((d) => d.code)).toEqual(["SCHEMA_INVALID"]);
	});
});

describe("Loader: prototype-named keys", () => {
	it.each(["__proto__", "constructor", "prototype"])(
		"treats %s as an ordinary own key",
		(key) => {
			const result = loadText(
				`id: demo\nfacts:\n  ${key}:\n    type: number\n`,
				FILE,
			);
			expect(result.ok).toBe(true);
			if (!result.ok) return;
			const facts = result.raw.facts as Record<string, unknown>;
			expect(Object.hasOwn(facts, key)).toBe(true);
			expect(facts[key]).toEqual({ type: "number" });
			expect(Object.getPrototypeOf(facts)).toBe(Object.prototype);
			expect(Object.getPrototypeOf(result.raw)).toBe(Object.prototype);
			expect(Object.keys(facts)).toEqual([key]);
		},
	);

	it("does not pollute Object.prototype", () => {
		loadText("__proto__:\n  polluted: true\n", FILE);
		expect(({} as Record<string, unknown>).polluted).toBeUndefined();
		const top = loadText("__proto__:\n  polluted: true\n", FILE);
		if (top.ok) {
			expect(Object.getPrototypeOf(top.raw)).toBe(Object.prototype);
			expect(Object.hasOwn(top.raw, "__proto__")).toBe(true);
		}
	});
});

describe("Loader: non-string keys", () => {
	it("reports an unquoted clause key 4.2 and tells the author to quote it", () => {
		const result = loadText("clauses:\n  4.2:\n    title: A\n", FILE);
		expect(result.ok).toBe(false);
		expect(result.diagnostics).toHaveLength(1);
		const [d] = result.diagnostics;
		expect(d?.code).toBe("SCHEMA_INVALID");
		expect(d?.message).toContain("4.2");
		expect(d?.message).toMatch(/[Qq]uote/);
	});

	it("accepts the quoted clause key", () => {
		expect(loadText('clauses:\n  "4.2":\n    title: A\n', FILE).ok).toBe(true);
	});
});

describe("Loader: size limit", () => {
	function padded(bytes: number): string {
		const head = "id: demo\n# ";
		return `${head}${"x".repeat(bytes - head.length - 1)}\n`;
	}

	it("accepts exactly 1 MiB", () => {
		const text = padded(MAX_FILE_BYTES);
		expect(new TextEncoder().encode(text).length).toBe(MAX_FILE_BYTES);
		expect(loadText(text, FILE).ok).toBe(true);
	});

	it("rejects one byte more", () => {
		const text = padded(MAX_FILE_BYTES + 1);
		expect(new TextEncoder().encode(text).length).toBe(MAX_FILE_BYTES + 1);
		const result = loadText(text, FILE);
		expect(result.ok).toBe(false);
		expect(result.diagnostics.map((d) => d.code)).toEqual(["SCHEMA_INVALID"]);
		expect(result.diagnostics[0]?.message).toContain("1 MiB");
	});

	it("measures bytes, not characters, for multi-byte text", () => {
		// 3 bytes per character: fewer than MAX characters but more than MAX bytes.
		const text = `id: demo\n# ${"€".repeat(Math.ceil(MAX_FILE_BYTES / 3))}\n`;
		expect(text.length).toBeLessThan(MAX_FILE_BYTES);
		expect(loadText(text, FILE).diagnostics[0]?.code).toBe("SCHEMA_INVALID");
	});

	it("rejects an oversized file read through a Host before decoding", () => {
		const result = readKbFile(
			"p",
			FILE,
			hostReturning(new Uint8Array(MAX_FILE_BYTES + 1)),
		);
		expect("diagnostics" in result).toBe(true);
		if ("diagnostics" in result) {
			expect(result.diagnostics.map((d) => d.code)).toEqual(["SCHEMA_INVALID"]);
		}
	});
});

describe("readKbFile", () => {
	it("decodes valid UTF-8 and drops a byte-order mark", () => {
		const body = new TextEncoder().encode("id: démo\n");
		const withBom = new Uint8Array([0xef, 0xbb, 0xbf, ...body]);
		expect(readKbFile("p", FILE, hostReturning(withBom))).toEqual({
			text: "id: démo\n",
		});
	});

	it("gives one READ_ERROR naming the file for invalid UTF-8", () => {
		const result = readKbFile(
			"p",
			FILE,
			hostReturning(new Uint8Array([0x69, 0x64, 0x3a, 0xff, 0xfe])),
		);
		expect("diagnostics" in result).toBe(true);
		if (!("diagnostics" in result)) return;
		expect(result.diagnostics).toHaveLength(1);
		const [d] = result.diagnostics;
		expect(d?.code).toBe("READ_ERROR");
		expect(d?.severity).toBe("error");
		expect(d?.file).toBe(FILE);
		expect(d?.message).toContain(FILE);
		expect(d?.message).toContain("not valid UTF-8");
	});

	it("gives a READ_ERROR containing the host reason when the read fails", () => {
		const result = readKbFile(
			"p",
			FILE,
			hostFailing("EACCES: permission denied"),
		);
		expect("diagnostics" in result).toBe(true);
		if (!("diagnostics" in result)) return;
		expect(result.diagnostics).toHaveLength(1);
		const [d] = result.diagnostics;
		expect(d?.code).toBe("READ_ERROR");
		expect(d?.file).toBe(FILE);
		expect(d?.message).toContain(FILE);
		expect(d?.message).toContain("EACCES: permission denied");
		expect(d?.message).not.toContain("not valid UTF-8");
	});

	it("does not throw when the host throws a non-HostError", () => {
		const host: Host = {
			...hostReturning(new Uint8Array()),
			readFile: () => {
				throw new Error("boom");
			},
		};
		const result = readKbFile("p", FILE, host);
		expect("diagnostics" in result && result.diagnostics[0]?.code).toBe(
			"READ_ERROR",
		);
	});

	it("never uses YAML_SYNTAX for read or decoding failures", () => {
		for (const host of [
			hostFailing("ENOENT: no such file"),
			hostReturning(new Uint8Array([0xc0, 0xaf])),
		]) {
			const result = readKbFile("p", FILE, host);
			expect("diagnostics" in result).toBe(true);
			if ("diagnostics" in result) {
				expect(result.diagnostics.map((d) => d.code)).not.toContain(
					"YAML_SYNTAX",
				);
			}
		}
	});
});
