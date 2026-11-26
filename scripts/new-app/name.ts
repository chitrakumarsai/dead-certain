// App names for pnpm new-app (requirements 2.1, 2.2, 3.7). Pure: no file, no Node module.

/** Names that are folders or files in the deployed site, so no app may take them (2.2). */
export const RESERVED: readonly string[] = [
	"site",
	"kit",
	"assets",
	"templates",
	"index",
	"404",
];

const NAME = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
const MIN = 2;
const MAX = 30;

export type NameResult =
	| { ok: true; name: string; title: string; slugConst: string }
	| { ok: false; code: "BAD_NAME" | "RESERVED" | "EXISTS"; message: string };

/** "loan-check" gives "Loan Check" (3.7). */
export const titleOf = (name: string): string =>
	name
		.split("-")
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(" ");

/** "loan-check" gives "loanCheck", its key in PAGES (13.4). */
export const keyOf = (name: string): string =>
	name.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase());

/** "loan-check" gives "LOAN_CHECK" (3.7). */
export const constOf = (name: string): string =>
	name.toUpperCase().replace(/-/g, "_");

/**
 * Decides a name. `taken` holds the apps the site already serves. Never throws.
 * The name is shown in a message only after it has passed the pattern, so a
 * refused name is never echoed with its control characters.
 */
export function validateName(
	name: string,
	taken: readonly string[],
): NameResult {
	if (name.length < MIN || name.length > MAX || !NAME.test(name))
		return {
			ok: false,
			code: "BAD_NAME",
			message: `An app name is ${MIN} to ${MAX} lower-case letters, digits and single hyphens, and starts with a letter, such as loan-check.`,
		};
	if (RESERVED.includes(name))
		return {
			ok: false,
			code: "RESERVED",
			message: `${name} is reserved: the deployed site already has a ${name} folder or file.`,
		};
	if (taken.includes(name))
		return {
			ok: false,
			code: "EXISTS",
			message: `${name} is taken: the site already serves /dead-certain/${name}/.`,
		};
	return { ok: true, name, title: titleOf(name), slugConst: constOf(name) };
}
