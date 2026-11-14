import { dayNumber, fromDayNumber } from "../calendar";
import {
	checkValue,
	normaliseValue,
	validateAnswers,
	validateKb,
} from "../check";
import { EngineError } from "../errors";
import { isValidDate } from "../lang/dates";
import type { FactDef, FactValue, KnowledgeBase, Session } from "../types";
import { base64urlDecode, base64urlEncode } from "./base64url";
import { ByteReader, ByteWriter, utf8Encode } from "./bytes";
import { sha256 } from "./sha256";

/** Token format version. */
const VERSION = 1;
/** Fingerprint length in bytes (128 bits of SHA-256). */
const FINGERPRINT_BYTES = 16;

/** Type tags in the payload. */
const TAG_FALSE = 0;
const TAG_TRUE = 1;
const TAG_NUMBER = 2;
const TAG_MONEY = 3;
const TAG_DATE = 4;
const TAG_ENUM = 5;

/** Added to a day number so that 0001-01-01 maps to 0 (dates are unsigned varints). */
const DATE_OFFSET = -dayNumber("0001-01-01");

/** First 16 bytes of SHA-256 over `JSON.stringify(kb)`. */
function fingerprint(kb: KnowledgeBase): Uint8Array {
	return sha256(utf8Encode(JSON.stringify(kb))).slice(0, FINGERPRINT_BYTES);
}

/** Fact names in ascending UTF-16 code-unit order. */
function sortedNames(kb: KnowledgeBase): string[] {
	return Object.keys(kb.facts).sort();
}

function malformed(message: string): EngineError {
	return new EngineError("MALFORMED_TOKEN", message);
}

/** Replay token for a valid Session. Throws the Requirement 3 codes for bad input. */
export function encode(s: Session): string {
	validateKb(s.kb);
	validateAnswers(s.kb, s.answers);
	const names = sortedNames(s.kb);
	const indexOf = new Map(names.map((name, i) => [name, i]));
	const answered = Object.keys(s.answers).sort();

	const w = new ByteWriter();
	w.byte(VERSION).raw(fingerprint(s.kb)).varint(answered.length);
	for (const name of answered) {
		const def = s.kb.facts[name] as FactDef;
		const value = normaliseValue(s.answers[name] as FactValue);
		w.varint(indexOf.get(name) as number);
		switch (def.type) {
			case "boolean":
				w.byte(value === true ? TAG_TRUE : TAG_FALSE);
				break;
			case "number":
				w.byte(TAG_NUMBER).float64(value as number);
				break;
			case "money": {
				const n = value as number;
				w.byte(TAG_MONEY)
					.byte(n < 0 ? 1 : 0)
					.varint(Math.abs(n));
				break;
			}
			case "date":
				w.byte(TAG_DATE).varint(dayNumber(value as string) + DATE_OFFSET);
				break;
			case "enum":
				w.byte(TAG_ENUM).varint(
					(def.options as string[]).indexOf(value as string),
				);
				break;
		}
	}
	return base64urlEncode(w.toBytes());
}

/** One answer as read from the payload, before it is checked against the KB. */
interface RawAnswer {
	readonly index: number;
	readonly tag: number;
	readonly payload: number | boolean;
	readonly negative: boolean;
}

/** Reads the payload. Needs no Knowledge_Base except to name a repeated fact. */
function readPayload(r: ByteReader, names: readonly string[]): RawAnswer[] {
	const count = r.varint();
	// Every answer takes at least two bytes, so a larger count cannot be real.
	if (count * 2 > r.remaining) {
		throw malformed("Token answer count does not fit the payload.");
	}
	const out: RawAnswer[] = [];
	let previous = -1;
	for (let i = 0; i < count; i++) {
		const index = r.varint();
		if (index <= previous) {
			const fact = names[index];
			throw malformed(
				index === previous && fact !== undefined
					? `Token lists fact "${fact}" more than once.`
					: index === previous
						? `Token lists fact index ${index} more than once.`
						: `Token answers are out of order at fact index ${index}.`,
			);
		}
		previous = index;
		const tag = r.byte();
		let payload: number | boolean = 0;
		let negative = false;
		switch (tag) {
			case TAG_FALSE:
			case TAG_TRUE:
				break;
			case TAG_NUMBER:
				payload = r.float64();
				if (Object.is(payload, -0)) {
					throw malformed("Token has a non-canonical number (negative zero).");
				}
				break;
			case TAG_MONEY: {
				const sign = r.byte();
				if (sign > 1) throw malformed("Token has an invalid money sign.");
				payload = r.varint();
				negative = sign === 1;
				if (negative && payload === 0) {
					throw malformed("Token has a non-canonical money amount.");
				}
				break;
			}
			case TAG_DATE:
			case TAG_ENUM:
				payload = r.varint();
				break;
			default:
				throw malformed(`Token has an unknown value tag ${tag}.`);
		}
		out.push({ index, tag, payload, negative });
	}
	if (r.remaining > 0) throw malformed("Token has trailing bytes.");
	return out;
}

/** Tag a fact of this definition must carry, or -1 when the tag is a boolean tag. */
function expectedTag(def: FactDef): number {
	switch (def.type) {
		case "number":
			return TAG_NUMBER;
		case "money":
			return TAG_MONEY;
		case "date":
			return TAG_DATE;
		case "enum":
			return TAG_ENUM;
		default:
			return -1;
	}
}

/** Value for a raw answer, or `undefined` when it does not fit the fact (INVALID_ANSWER). */
function toValue(raw: RawAnswer, def: FactDef): FactValue | undefined {
	const want = expectedTag(def);
	if (want === -1) {
		if (def.type !== "boolean") return undefined;
		return raw.tag === TAG_TRUE
			? true
			: raw.tag === TAG_FALSE
				? false
				: undefined;
	}
	if (raw.tag !== want) return undefined;
	const p = raw.payload as number;
	switch (raw.tag) {
		case TAG_NUMBER:
			return p;
		case TAG_MONEY:
			return raw.negative ? -p : p;
		case TAG_DATE: {
			const iso = fromDayNumber(p - DATE_OFFSET);
			return isValidDate(iso) ? iso : undefined;
		}
		default:
			return def.options?.[p];
	}
}

/** Rebuilds a Session from a token. Checks run in the order of Requirement 11, criterion 10. */
export function decode(kb: KnowledgeBase, token: string): Session {
	if (token === "") throw malformed("Token is empty.");
	const r = new ByteReader(base64urlDecode(token));
	if (r.remaining === 0) throw malformed("Token has no version byte.");
	const version = r.byte();
	if (version !== VERSION) {
		throw new EngineError(
			"UNSUPPORTED_VERSION",
			`Token format version ${version} is not supported.`,
		);
	}
	const found = r.raw(FINGERPRINT_BYTES);
	const names = sortedNames(kb);
	const raws = readPayload(r, names);

	const expected = fingerprint(kb);
	if (found.some((b, i) => b !== expected[i])) {
		throw new EngineError(
			"KB_MISMATCH",
			"The rules have changed since this link was made, so it cannot be replayed.",
		);
	}
	validateKb(kb);

	const entries: [string, FactValue | undefined][] = [];
	for (const raw of raws) {
		const name = names[raw.index];
		if (name === undefined) {
			throw new EngineError(
				"UNKNOWN_FACT",
				`Token refers to fact number ${raw.index}, which is not in the knowledge base.`,
			);
		}
		const value = toValue(raw, kb.facts[name] as FactDef);
		// Values that do not fit their fact are `undefined`, rejected as INVALID_ANSWER.
		// Checking one fact at a time reports the first fault in sorted fact-name order.
		checkValue(kb, name, value);
		entries.push([name, value]);
	}
	// fromEntries defines own properties, so `__proto__` is a safe fact name.
	const answers = Object.fromEntries(entries);
	return { kb, answers: answers as Record<string, FactValue> };
}
