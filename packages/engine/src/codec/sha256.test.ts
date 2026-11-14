// Node's crypto and Buffer serve as oracles in this test file only. The repo
// has no @types/node, so they are typed by hand.
// @ts-expect-error TS2591: no type definitions for node:crypto
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { base64urlDecode, base64urlEncode } from "./base64url";
import { ByteReader, ByteWriter, utf8Encode } from "./bytes";
import { sha256 } from "./sha256";

interface NodeBuffer extends Uint8Array {
	toString(encoding?: string): string;
}
const Buffer = (
	globalThis as unknown as {
		Buffer: { from(data: Uint8Array | string, encoding?: string): NodeBuffer };
	}
).Buffer;

const hex = (b: Uint8Array): string =>
	Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");

function codeOf(fn: () => unknown): string | undefined {
	try {
		fn();
	} catch (e) {
		return (e as { code?: string }).code;
	}
	return undefined;
}

describe("sha256", () => {
	it("matches the published vector for the empty string", () => {
		expect(hex(sha256(new Uint8Array(0)))).toBe(
			"e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
		);
	});

	it("matches the published vector for abc", () => {
		expect(hex(sha256(utf8Encode("abc")))).toBe(
			"ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
		);
	});

	it("matches the published two-block vector", () => {
		const msg = "abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq";
		expect(hex(sha256(utf8Encode(msg)))).toBe(
			"248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1",
		);
	});

	it("agrees with node:crypto around the padding boundaries", () => {
		for (const n of [0, 1, 54, 55, 56, 63, 64, 65, 119, 120, 128, 1000]) {
			const data = Uint8Array.from({ length: n }, (_, i) => (i * 7 + 3) & 255);
			const expected = createHash("sha256").update(data).digest("hex");
			expect(hex(sha256(data))).toBe(expected);
		}
	});
});

describe("base64url", () => {
	it("matches RFC 4648 vectors without padding", () => {
		const cases: [string, string][] = [
			["", ""],
			["f", "Zg"],
			["fo", "Zm8"],
			["foo", "Zm9v"],
			["foob", "Zm9vYg"],
			["fooba", "Zm9vYmE"],
			["foobar", "Zm9vYmFy"],
		];
		for (const [text, encoded] of cases) {
			expect(base64urlEncode(utf8Encode(text))).toBe(encoded);
			expect(base64urlDecode(encoded)).toEqual(utf8Encode(text));
		}
	});

	it("uses - and _ and agrees with Buffer", () => {
		const data = Uint8Array.from([0xfb, 0xff, 0xfe, 0x3e, 0x3f]);
		const encoded = base64urlEncode(data);
		expect(encoded).toBe(Buffer.from(data).toString("base64url"));
		expect(encoded).toMatch(/[-_]/);
		expect(base64urlDecode(encoded)).toEqual(data);
	});

	it("round-trips every length from 0 to 40", () => {
		for (let n = 0; n <= 40; n++) {
			const data = Uint8Array.from({ length: n }, (_, i) => (i * 31 + n) & 255);
			expect(base64urlDecode(base64urlEncode(data))).toEqual(data);
		}
	});

	it("rejects a length of 1 modulo 4", () => {
		for (const t of ["A", "AAAAA", "AAAAAAAAA"]) {
			expect(codeOf(() => base64urlDecode(t))).toBe("MALFORMED_TOKEN");
		}
	});

	it("rejects characters outside the alphabet", () => {
		for (const t of ["AA==", "A+AA", "A/AA", "AA A", "AAé", "AA\u{1F600}A"]) {
			expect(codeOf(() => base64urlDecode(t))).toBe("MALFORMED_TOKEN");
		}
	});

	it("rejects non-zero spare bits", () => {
		// "Zg" is canonical; "Zh" sets a spare bit. "Zm8" canonical; "Zm9" sets one.
		expect(codeOf(() => base64urlDecode("Zh"))).toBe("MALFORMED_TOKEN");
		expect(codeOf(() => base64urlDecode("Zm9"))).toBe("MALFORMED_TOKEN");
	});
});

describe("varints", () => {
	const write = (v: number) => new ByteWriter().varint(v).toBytes();

	it("writes known canonical encodings", () => {
		expect(Array.from(write(0))).toEqual([0]);
		expect(Array.from(write(127))).toEqual([127]);
		expect(Array.from(write(128))).toEqual([0x80, 0x01]);
		expect(Array.from(write(300))).toEqual([0xac, 0x02]);
	});

	it("round-trips boundary values up to 2^53 - 1", () => {
		const values = [
			0,
			1,
			127,
			128,
			16383,
			16384,
			2 ** 31,
			2 ** 32,
			2 ** 49,
			Number.MAX_SAFE_INTEGER,
		];
		for (const v of values) {
			const r = new ByteReader(write(v));
			expect(r.varint()).toBe(v);
			expect(r.remaining).toBe(0);
		}
	});

	it("rejects invalid values on write", () => {
		for (const v of [-1, 1.5, Number.NaN, 2 ** 53]) {
			expect(() => new ByteWriter().varint(v)).toThrow(RangeError);
		}
	});

	it("rejects non-minimal varints", () => {
		for (const bytes of [
			[0x80, 0x00],
			[0x81, 0x00],
			[0xff, 0x80, 0x00],
		]) {
			const r = new ByteReader(Uint8Array.from(bytes));
			expect(codeOf(() => r.varint())).toBe("MALFORMED_TOKEN");
		}
	});

	it("rejects truncated, too long and too large varints", () => {
		const cases = [
			[0x80],
			new Array(9).fill(0x80).concat([0x01]), // 9 bytes: too long
			[...new Array(7).fill(0xff), 0x7f], // 2^56 - 1 > 2^53 - 1
		];
		for (const bytes of cases) {
			const r = new ByteReader(Uint8Array.from(bytes));
			expect(codeOf(() => r.varint())).toBe("MALFORMED_TOKEN");
		}
	});
});

describe("ByteWriter and ByteReader", () => {
	it("round-trips float64 big-endian, including negative zero", () => {
		const w = new ByteWriter().float64(1.5).float64(-0);
		const bytes = w.toBytes();
		expect(Array.from(bytes.slice(0, 8))).toEqual([
			0x3f, 0xf8, 0, 0, 0, 0, 0, 0,
		]);
		const r = new ByteReader(bytes);
		expect(r.float64()).toBe(1.5);
		expect(Object.is(r.float64(), -0)).toBe(true);
	});

	it("rejects reads past the end", () => {
		const r = new ByteReader(Uint8Array.from([1, 2]));
		expect(codeOf(() => r.raw(3))).toBe("MALFORMED_TOKEN");
		expect(r.byte()).toBe(1);
		expect(r.byte()).toBe(2);
		expect(codeOf(() => r.byte())).toBe("MALFORMED_TOKEN");
		expect(codeOf(() => new ByteReader(new Uint8Array(7)).float64())).toBe(
			"MALFORMED_TOKEN",
		);
	});

	it("rejects out-of-range bytes on write", () => {
		expect(() => new ByteWriter().byte(256)).toThrow(RangeError);
		expect(() => new ByteWriter().byte(-1)).toThrow(RangeError);
	});
});

describe("utf8Encode", () => {
	it("agrees with Buffer, replacing lone surrogates with U+FFFD", () => {
		for (const s of ["", "abc", "é", "€", "\u{1F600}", "\ud800x", "x\udc00"]) {
			expect(Array.from(utf8Encode(s))).toEqual(
				Array.from(Buffer.from(s, "utf8")),
			);
		}
	});
});
