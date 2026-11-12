import { EngineError } from "../errors";

/** RFC 4648 section 5 alphabet. */
const ALPHABET =
	"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

/** Character code to 6-bit value, or -1 outside the alphabet. */
const LOOKUP: Int8Array = (() => {
	const table = new Int8Array(128).fill(-1);
	for (let i = 0; i < ALPHABET.length; i++) {
		table[ALPHABET.charCodeAt(i)] = i;
	}
	return table;
})();

/** Encode bytes as base64url without padding. */
export function base64urlEncode(bytes: Uint8Array): string {
	let out = "";
	let i = 0;
	for (; i + 2 < bytes.length; i += 3) {
		const n =
			((bytes[i] as number) << 16) |
			((bytes[i + 1] as number) << 8) |
			(bytes[i + 2] as number);
		out +=
			ALPHABET.charAt((n >>> 18) & 63) +
			ALPHABET.charAt((n >>> 12) & 63) +
			ALPHABET.charAt((n >>> 6) & 63) +
			ALPHABET.charAt(n & 63);
	}
	const rest = bytes.length - i;
	if (rest === 1) {
		const n = (bytes[i] as number) << 16;
		out += ALPHABET.charAt((n >>> 18) & 63) + ALPHABET.charAt((n >>> 12) & 63);
	} else if (rest === 2) {
		const n = ((bytes[i] as number) << 16) | ((bytes[i + 1] as number) << 8);
		out +=
			ALPHABET.charAt((n >>> 18) & 63) +
			ALPHABET.charAt((n >>> 12) & 63) +
			ALPHABET.charAt((n >>> 6) & 63);
	}
	return out;
}

/**
 * Strictly decode base64url without padding. Throws MALFORMED_TOKEN for a
 * character outside the alphabet, a length of 1 modulo 4, or non-zero spare
 * bits in the last character. The empty string decodes to zero bytes.
 */
export function base64urlDecode(text: string): Uint8Array {
	const length = text.length;
	if (length % 4 === 1) {
		throw new EngineError(
			"MALFORMED_TOKEN",
			"Token length is invalid (1 modulo 4).",
		);
	}
	const values = new Uint8Array(length);
	for (let i = 0; i < length; i++) {
		const code = text.charCodeAt(i);
		const v = code < 128 ? (LOOKUP[code] as number) : -1;
		if (v < 0) {
			throw new EngineError(
				"MALFORMED_TOKEN",
				`Token has a character outside the alphabet at position ${i}.`,
			);
		}
		values[i] = v;
	}
	const byteCount = Math.floor((length * 6) / 8);
	const out = new Uint8Array(byteCount);
	let o = 0;
	let i = 0;
	for (; i + 3 < length; i += 4) {
		const n =
			((values[i] as number) << 18) |
			((values[i + 1] as number) << 12) |
			((values[i + 2] as number) << 6) |
			(values[i + 3] as number);
		out[o++] = (n >>> 16) & 255;
		out[o++] = (n >>> 8) & 255;
		out[o++] = n & 255;
	}
	const rest = length - i;
	if (rest === 2) {
		const n = ((values[i] as number) << 6) | (values[i + 1] as number);
		if ((n & 15) !== 0) {
			throw new EngineError(
				"MALFORMED_TOKEN",
				"Token has non-zero spare bits in its last character.",
			);
		}
		out[o++] = n >>> 4;
	} else if (rest === 3) {
		const n =
			((values[i] as number) << 12) |
			((values[i + 1] as number) << 6) |
			(values[i + 2] as number);
		if ((n & 3) !== 0) {
			throw new EngineError(
				"MALFORMED_TOKEN",
				"Token has non-zero spare bits in its last character.",
			);
		}
		out[o++] = (n >>> 10) & 255;
		out[o++] = (n >>> 2) & 255;
	}
	return out;
}
