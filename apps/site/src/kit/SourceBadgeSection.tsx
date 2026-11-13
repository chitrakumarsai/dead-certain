import { SourceBadge, type SourceBadgeProps } from "@dead-certain/ui";
import { OnFilm } from "./OnFilm";
import { Specimen } from "./Specimen";

const SOURCES: { source: SourceBadgeProps["source"]; note: string }[] = [
	{ source: "answered", note: "A fact the reader typed or picked." },
	{ source: "collected", note: "A fact Pre-Flight read from GitHub." },
	{ source: "derived", note: "A fact a rule worked out from other facts." },
];

const SURFACES = ["paper", "film"] as const;

export const SOURCE_BADGE_SPECIMENS = SURFACES.flatMap((surface) =>
	SOURCES.map(({ source }) => ({
		id: `sourcebadge-${source}-${surface}`,
		title: `${source} on ${surface}`,
	})),
);

export function SourceBadgeSection() {
	return (
		<section aria-labelledby="sourcebadge-heading" className="pt-16">
			<h2
				id="sourcebadge-heading"
				className="font-doc text-verdict font-semibold"
			>
				SourceBadge
			</h2>
			<div className="grid md:grid-cols-2 md:gap-x-8">
				{SOURCES.flatMap(({ source, note }) =>
					SURFACES.map((surface) => (
						<Specimen
							key={`${source}-${surface}`}
							id={`sourcebadge-${source}-${surface}`}
							title={`${source[0]?.toUpperCase()}${source.slice(1)} on ${surface}`}
							note={note}
						>
							{surface === "film" ? (
								<OnFilm>
									<SourceBadge source={source} />
								</OnFilm>
							) : (
								<SourceBadge source={source} />
							)}
						</Specimen>
					)),
				)}
			</div>
		</section>
	);
}
