export interface BarPartition {
	/** One flex-grow value per input value, in the same order. */
	readonly parts: readonly number[];
	/** The flex-grow of the unfilled rest of the bar. */
	readonly remainder: number;
}

const usable = (n: number): number =>
	Number.isSafeInteger(n) && n > 0 ? n : 0;

/**
 * Splits a bar of `total` into integer flex-grow values, with no percentages
 * and no rounding. A negative or non-integer value counts as 0. When the
 * values add up to more than the total, later ones are cut so the bar is
 * exactly full and there is no remainder. Parts plus remainder equal `total`.
 */
export function partitionBar(
	total: number,
	values: readonly number[],
): BarPartition {
	let left = usable(total);
	const parts = values.map((value) => {
		const part = Math.min(usable(value), left);
		left -= part;
		return part;
	});
	return { parts, remainder: left };
}
