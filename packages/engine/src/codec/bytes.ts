import { EngineError } from "../errors";

/** Longest varint the codec accepts: 8 bytes carry 56 bits, enough for 2^53 - 1. */
const MAX_VARINT_BYTES = 8;

/** Encode a string as UTF-8. Lone surrogates become U+FFFD, like `TextEncoder`. */
export function utf8Encode(text: string): Uint8Array {
	const out: number[] = [];
	for (let i = 0; i < text.length; i++) {
		let cp = text.charCodeAt(i);
		if (cp >= 0xd800 && cp <= 0xdbff) {
			const low = i + 1 < text.length ? text.charCodeAt(i + 1) : 0;
			if (low >= 0xdc00 && low <= 0xdfff) {
				cp = 0x10000 + ((cp - 0xd800) << 10) + (low - 0xdc00);
				i++;
			} else {
				cp = 0xfffd;
			}
		} else if (cp >= 0xdc00 && cp <= 0xdfff) {
			cp = 0xfffd;
		}
		if (cp < 0x80) {
			out.push(cp);
		} else if (cp < 0x800) {
			out.push(0xc0 | (cp >> 6), 0x80 | (cp & 63));
		} else if (cp < 0x10000) {
			out.push(0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
		} else {
			out.push(
				0xf0 | (cp >> 18),
				0x80 | ((cp >> 12) & 63),
				0x80 | ((cp >> 6) & 63),
				0x80 | (cp & 63),
			);
		}
	}
	return Uint8Array.from(out);
}

/** Append-only byte buffer with the codec's canonical writers. */
export class ByteWriter {
	private readonly bytes: number[] = [];

	/** Number of bytes written so far. */
	get length(): number {
		return this.bytes.length;
	}

	/** Write one byte (0 to 255). */
	byte(value: number): this {
		if (!Number.isInteger(value) || value < 0 || value > 255) {
			throw new RangeError(`Not a byte: ${value}`);
		}
		this.bytes.push(value);
		return this;
	}

	/** Write raw bytes. */
	raw(data: Uint8Array): this {
		for (const b of data) this.bytes.push(b);
		return this;
	}

	/** Write a minimal unsigned LEB128 varint for an integer in 0..2^53-1. */
	varint(value: number): this {
		if (!Number.isSafeInteger(value) || value < 0) {
			throw new RangeError(`Not an unsigned safe integer: ${value}`);
		}
		let rest = value;
		while (rest >= 128) {
			this.bytes.push((rest % 128) + 128);
			rest = Math.floor(rest / 128);
		}
		this.bytes.push(rest);
		return this;
	}

	/** Write a big-endian IEEE 754 double. */
	float64(value: number): this {
		const buffer = new Uint8Array(8);
		new DataView(buffer.buffer).setFloat64(0, value, false);
		return this.raw(buffer);
	}

	/** The bytes written so far. */
	toBytes(): Uint8Array {
		return Uint8Array.from(this.bytes);
	}
}

/** Strict forward reader. Every failure throws MALFORMED_TOKEN. */
export class ByteReader {
	private position = 0;

	constructor(private readonly data: Uint8Array) {}

	/** Bytes not yet read. */
	get remaining(): number {
		return this.data.length - this.position;
	}

	/** Index of the next byte to read. */
	get offset(): number {
		return this.position;
	}

	/** Read one byte. */
	byte(): number {
		if (this.position >= this.data.length) {
			throw new EngineError("MALFORMED_TOKEN", "Token is truncated.");
		}
		return this.data[this.position++] as number;
	}

	/** Read `count` raw bytes. */
	raw(count: number): Uint8Array {
		if (!Number.isSafeInteger(count) || count < 0 || count > this.remaining) {
			throw new EngineError("MALFORMED_TOKEN", "Token is truncated.");
		}
		const out = this.data.slice(this.position, this.position + count);
		this.position += count;
		return out;
	}

	/** Read a minimal unsigned LEB128 varint no larger than 2^53 - 1. */
	varint(): number {
		let value = 0;
		let scale = 1;
		for (let i = 0; i < MAX_VARINT_BYTES; i++) {
			const b = this.byte();
			const low = b % 128;
			if (b < 128) {
				if (low === 0 && i > 0) {
					throw new EngineError(
						"MALFORMED_TOKEN",
						"Token has a non-minimal varint.",
					);
				}
				value += low * scale;
				if (value > Number.MAX_SAFE_INTEGER) {
					throw new EngineError(
						"MALFORMED_TOKEN",
						"Token has a varint that is too large.",
					);
				}
				return value;
			}
			value += low * scale;
			scale *= 128;
		}
		throw new EngineError(
			"MALFORMED_TOKEN",
			"Token has a varint that is too long.",
		);
	}

	/** Read a big-endian IEEE 754 double. */
	float64(): number {
		const bytes = this.raw(8);
		return new DataView(bytes.buffer).getFloat64(0, false);
	}
}
