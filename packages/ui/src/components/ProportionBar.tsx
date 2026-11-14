import { useId } from "react";
import { lowerFirst } from "../format/label";
import { formatMoney } from "../format/money";
import type { FormatContext } from "../types";
import { partitionBar } from "./partitionBar";

export interface ProportionPart {
	kind: "paid" | "cut";
	/** Integer minor units, >= 0. */
	value: number;
	/** "Room rent above the limit". Read in the label for cuts. */
	label: string;
}

export interface ProportionBarProps {
	/** The claimed amount, > 0. */
	total: number;
	parts: readonly ProportionPart[];
	format: FormatContext;
}

function spoken(
	parts: readonly ProportionPart[],
	values: readonly number[],
	format: FormatContext,
): string {
	if (parts.length === 0) return "Nothing paid or cut yet.";
	const money = (minor: number) =>
		formatMoney(minor, format.currency ?? "INR", format.locale);
	return parts
		.map((part, i) =>
			part.kind === "paid"
				? `${money(values[i] ?? 0)} paid.`
				: `${money(values[i] ?? 0)} cut for ${lowerFirst(part.label)}.`,
		)
		.join(" ");
}

/**
 * How much is paid and how much is cut, at a glance. Each part grows by its
 * own integer value, so there is no percentage arithmetic and no rounding.
 * Cuts carry a hatch, so they differ from paid parts without colour.
 */
export function ProportionBar({ total, parts, format }: ProportionBarProps) {
	const hatchId = useId();
	const partition = partitionBar(
		total,
		parts.map((part) => part.value),
	);

	return (
		<div
			role="img"
			aria-label={spoken(parts, partition.parts, format)}
			className="flex h-6 w-full gap-(--bar-gap) bg-paper"
		>
			<svg width="0" height="0" className="absolute" aria-hidden="true">
				<defs>
					<pattern
						id={hatchId}
						width="6"
						height="6"
						patternUnits="userSpaceOnUse"
						patternTransform="rotate(45)"
					>
						<rect width="2" height="6" className="fill-paper" />
					</pattern>
				</defs>
			</svg>
			{parts.map((part, i) => {
				const grow = partition.parts[i] ?? 0;
				// A zero part is read in the label but takes no room in the bar.
				if (grow === 0) return null;
				return (
					<span
						// biome-ignore lint/suspicious/noArrayIndexKey: parts have no id and never reorder.
						key={i}
						data-part={part.kind}
						style={{ flexGrow: grow, flexBasis: 0 }}
						className={`relative min-w-(--bar-part-min) ${
							part.kind === "paid" ? "bg-paid" : "bg-reduced"
						}`}
					>
						{part.kind === "cut" && (
							<svg className="absolute inset-0 size-full" aria-hidden="true">
								<rect width="100%" height="100%" fill={`url(#${hatchId})`} />
							</svg>
						)}
					</span>
				);
			})}
			{partition.remainder > 0 && (
				<span
					data-part="remainder"
					style={{ flexGrow: partition.remainder, flexBasis: 0 }}
					className="bg-divider"
				/>
			)}
		</div>
	);
}
