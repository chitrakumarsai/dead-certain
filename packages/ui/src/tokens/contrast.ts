/** WCAG 2.x relative luminance of a `#rrggbb` colour. */
export function luminance(hex: string): number {
	const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex.trim());
	if (!match) throw new Error(`not a #rrggbb colour: ${hex}`);
	const [r, g, b] = match.slice(1).map((pair) => {
		const c = Number.parseInt(pair, 16) / 255;
		return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
	}) as [number, number, number];
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio. Symmetric in its arguments and always at least 1. */
export function contrast(a: string, b: string): number {
	const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [
		number,
		number,
	];
	return (hi + 0.05) / (lo + 0.05);
}
