import { Button, useAnnounce } from "@dead-certain/ui";
import { OnFilm } from "./OnFilm";
import { Specimen } from "./Specimen";

const VARIANTS = [
	{
		variant: "primary",
		label: "Continue",
		note: "The one main action on a sheet.",
	},
	{ variant: "secondary", label: "Back", note: "Any other action. Outlined." },
	{
		variant: "quiet",
		label: "Start over",
		note: "A low-stakes action, as underlined text.",
	},
] as const;

const SURFACES = ["paper", "film"] as const;

function ButtonSpecimen({
	variant,
	label,
	note,
	surface,
	isDisabled,
}: (typeof VARIANTS)[number] & {
	surface: (typeof SURFACES)[number];
	isDisabled: boolean;
}) {
	const announce = useAnnounce();
	const state = isDisabled ? "disabled" : "default";
	const id = `button-${variant}-${state}-${surface}`;
	const reasonId = `${id}-reason`;
	const button = (
		<div className="flex flex-wrap items-center gap-4">
			<Button
				variant={variant}
				disabled={isDisabled}
				aria-describedby={isDisabled ? reasonId : undefined}
				onClick={() => announce(`${label} pressed.`)}
			>
				{label}
			</Button>
			{isDisabled && (
				<p id={reasonId} className="text-sys-small text-text-soft">
					Answer the question first.
				</p>
			)}
		</div>
	);

	return (
		<Specimen
			id={id}
			title={`${variant[0]?.toUpperCase()}${variant.slice(1)}, ${state}, on ${surface}`}
			note={
				isDisabled
					? "Disabled stays in the tab order. The reason sits beside it, not in a tooltip."
					: note
			}
		>
			{surface === "film" ? <OnFilm>{button}</OnFilm> : button}
		</Specimen>
	);
}

export const BUTTON_SPECIMENS = VARIANTS.flatMap(({ variant }) =>
	["default", "disabled"].flatMap((state) =>
		SURFACES.map((surface) => ({
			id: `button-${variant}-${state}-${surface}`,
			title: `${variant[0]?.toUpperCase()}${variant.slice(1)} ${state} ${surface}`,
		})),
	),
);

export function ButtonsSection() {
	return (
		<section aria-labelledby="buttons-heading" className="pt-16">
			<h2 id="buttons-heading" className="font-doc text-verdict font-semibold">
				Button
			</h2>
			<p className="max-w-column pt-2 text-text-soft">
				Hover, press and focus the real buttons. Pressing announces the action.
			</p>
			<div className="grid md:grid-cols-2 md:gap-x-8">
				{VARIANTS.flatMap((spec) =>
					[false, true].flatMap((isDisabled) =>
						SURFACES.map((surface) => (
							<ButtonSpecimen
								key={`${spec.variant}-${isDisabled}-${surface}`}
								{...spec}
								surface={surface}
								isDisabled={isDisabled}
							/>
						)),
					),
				)}
			</div>
		</section>
	);
}
