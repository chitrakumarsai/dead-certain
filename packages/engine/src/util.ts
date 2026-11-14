/** Own-key lookup that is safe for names such as `__proto__` and `constructor`. */
export function hasOwn(obj: object, key: string): boolean {
	return Object.hasOwn(obj, key);
}

/**
 * Structural equality for plain JSON-like values.
 * A property holding `undefined` equals an absent property.
 * `NaN` equals `NaN`; `0` equals `-0`.
 */
export function deepEqual(a: unknown, b: unknown): boolean {
	if (a === b) return true;
	if (typeof a === "number" && typeof b === "number") {
		return Number.isNaN(a) && Number.isNaN(b);
	}
	if (
		typeof a !== "object" ||
		typeof b !== "object" ||
		a === null ||
		b === null
	) {
		return false;
	}
	const aIsArray = Array.isArray(a);
	if (aIsArray !== Array.isArray(b)) return false;
	if (aIsArray) {
		const arrA = a as readonly unknown[];
		const arrB = b as readonly unknown[];
		if (arrA.length !== arrB.length) return false;
		for (let i = 0; i < arrA.length; i++) {
			if (!deepEqual(arrA[i], arrB[i])) return false;
		}
		return true;
	}
	const objA = a as Record<string, unknown>;
	const objB = b as Record<string, unknown>;
	for (const key of Object.keys(objA)) {
		const valueB = hasOwn(objB, key) ? objB[key] : undefined;
		if (!deepEqual(objA[key], valueB)) return false;
	}
	for (const key of Object.keys(objB)) {
		if (!hasOwn(objA, key) && objB[key] !== undefined) return false;
	}
	return true;
}

/**
 * Display name derived from a fact name: each `_` becomes one space and the
 * first code point is upper-cased. The rest is unchanged.
 */
export function deriveLabel(name: string): string {
	const spaced = name.replaceAll("_", " ");
	const first = spaced.codePointAt(0);
	if (first === undefined) return spaced;
	const head = String.fromCodePoint(first);
	return head.toUpperCase() + spaced.slice(head.length);
}

/** Cut `text` to at most `max` UTF-16 code units, never leaving half a surrogate pair. */
export function clip(text: string, max: number): string {
	if (text.length <= max) return text;
	let end = max;
	const last = text.charCodeAt(end - 1);
	if (end > 0 && last >= 0xd800 && last <= 0xdbff) end -= 1;
	return text.slice(0, end);
}
