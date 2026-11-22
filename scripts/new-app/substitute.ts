// Placeholder substitution for Template files (requirements 3.3, 3.6). Pure.

export interface Values {
	NAME: string;
	TITLE: string;
	SLUG_CONST: string;
	PORT: string;
}

export type Substituted =
	| { ok: true; text: string }
	| { ok: false; token: string };

/** Replaces each __APP_<KEY>__ with its value; an unknown __APP_ token is refused, never left in. */
export function substitute(text: string, values: Values): Substituted {
	let unknown: string | undefined;
	const out = text.replace(/__APP_([A-Z_]+?)__/g, (token, key: string) => {
		if (Object.hasOwn(values, key)) return values[key as keyof Values];
		unknown ??= token;
		return token;
	});
	if (unknown !== undefined) return { ok: false, token: unknown };
	if (out.includes("__APP_")) return { ok: false, token: "__APP_" };
	return { ok: true, text: out };
}
