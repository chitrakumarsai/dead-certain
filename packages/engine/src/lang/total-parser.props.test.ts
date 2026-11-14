// Feature: rule-language, Property 2: total parser
// Validates: Requirements 2.4, 8.3

import * as fc from "fast-check";
import { describe, it } from "vitest";
import type { ParseResult } from "./parse";
import { parse } from "./parse";

describe("total parser property", () => {
	it("parse() never throws on any string input", () => {
		// **Property 2: Total parser**
		// **Validates: Requirements 2.4, 8.3**
		fc.assert(
			fc.property(fc.string(), (input) => {
				let result: ParseResult;
				try {
					result = parse(input);
				} catch {
					return false; // threw — property violated
				}
				// Must return { ok: true } or { ok: false }
				return result.ok === true || result.ok === false;
			}),
			{ numRuns: 100 },
		);
	});
});
