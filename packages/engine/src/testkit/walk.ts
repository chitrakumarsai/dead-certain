// Test-only helpers: deep freeze and the Public_Value walker. No Node imports.

/** Freezes `value` and everything reachable from it. Returns the same value. */
export function deepFreeze<T>(value: T): T {
	if (typeof value !== "object" || value === null || Object.isFrozen(value)) {
		return value;
	}
	Object.freeze(value);
	for (const key of Reflect.ownKeys(value)) {
		deepFreeze((value as Record<PropertyKey, unknown>)[key]);
	}
	return value;
}

export interface PublicViolation {
	/** Property names and array indexes from the root, e.g. `audit.goals.f1[0]`. */
	readonly path: string;
	readonly reason: string;
}

/**
 * Walks a Public_Value and returns the first violation, or `undefined`.
 * Allowed: plain objects, arrays, strings, finite numbers, booleans, and
 * `undefined` only as an object property value. `path` names the root, for
 * example the Engine function that returned the value.
 */
export function walkPublic(
	value: unknown,
	path: string,
): PublicViolation | undefined {
	return walk(value, path, new Set(), false);
}

function walk(
	value: unknown,
	path: string,
	ancestors: Set<object>,
	isProperty: boolean,
): PublicViolation | undefined {
	switch (typeof value) {
		case "string":
		case "boolean":
			return undefined;
		case "number":
			return Number.isFinite(value)
				? undefined
				: { path, reason: `non-finite number ${String(value)}` };
		case "undefined":
			return isProperty
				? undefined
				: { path, reason: "undefined outside an object property" };
		case "symbol":
			return { path, reason: "symbol" };
		case "function":
			return { path, reason: "function" };
		case "bigint":
			return { path, reason: "bigint" };
		case "object":
			break;
	}
	if (value === null) return { path, reason: "null" };
	const obj = value as object;
	if (ancestors.has(obj)) return { path, reason: "circular reference" };
	const isArray = Array.isArray(obj);
	const proto = Object.getPrototypeOf(obj);
	if (proto !== (isArray ? Array.prototype : Object.prototype)) {
		return {
			path,
			reason: "prototype is not Object.prototype or Array.prototype",
		};
	}
	if (Object.getOwnPropertySymbols(obj).length > 0) {
		return { path, reason: "symbol-keyed property" };
	}
	ancestors.add(obj);
	try {
		if (isArray) {
			const items = obj as readonly unknown[];
			for (let i = 0; i < items.length; i++) {
				const found = walk(items[i], `${path}[${i}]`, ancestors, false);
				if (found !== undefined) return found;
			}
			return undefined;
		}
		for (const key of Object.keys(obj)) {
			const found = walk(
				(obj as Record<string, unknown>)[key],
				`${path}.${key}`,
				ancestors,
				true,
			);
			if (found !== undefined) return found;
		}
		return undefined;
	} finally {
		ancestors.delete(obj);
	}
}
