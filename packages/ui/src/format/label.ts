/**
 * A display name for a fact with no `FactDef.label`: underscores become
 * spaces and the first letter is capitalised. Same rule as the engine's.
 */
export function humanize(fact: string): string {
	const spaced = fact.replaceAll("_", " ");
	const first = spaced.codePointAt(0);
	if (first === undefined) return spaced;
	const head = String.fromCodePoint(first);
	return head.toUpperCase() + spaced.slice(head.length);
}
