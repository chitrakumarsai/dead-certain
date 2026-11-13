import { Button, Film, Sheet } from "@dead-certain/ui";
import { useEffect, useState, useSyncExternalStore } from "react";
import { OnFilm } from "./OnFilm";
import { Specimen } from "./Specimen";

const WIDE = "(min-width: 1280px)";
const subscribeWide = (onChange: () => void) => {
	const media = matchMedia(WIDE);
	media.addEventListener("change", onChange);
	return () => media.removeEventListener("change", onChange);
};
const useIsWide = () =>
	useSyncExternalStore(subscribeWide, () => matchMedia(WIDE).matches);

function ProofSample() {
	return (
		<p className="max-w-column">
			ROOM-03: other charges reduce in the same ratio as the room rent.
		</p>
	);
}

let mounts = 0;

/** Counts its own mounts, so a remount on a presentation flip would show. */
function MountProbe() {
	const [count, setCount] = useState(0);
	useEffect(() => {
		mounts += 1;
		setCount(mounts);
	}, []);
	return (
		<p data-film-probe className="pt-2 text-sys-small text-text-soft">
			Mounted {count} {count === 1 ? "time" : "times"}
		</p>
	);
}

function SideFilm() {
	const [isOpen, setIsOpen] = useState(true);
	return isOpen ? (
		<Film title="Why" presentation="side" open onClose={() => setIsOpen(false)}>
			<ProofSample />
		</Film>
	) : (
		<Button onClick={() => setIsOpen(true)}>Open the film</Button>
	);
}

function SheetFilm() {
	const [isOpen, setIsOpen] = useState(false);
	return (
		<>
			<Button onClick={() => setIsOpen(true)}>Open the film sheet</Button>
			<Film
				title="Why"
				presentation="sheet"
				open={isOpen}
				onClose={() => setIsOpen(false)}
			>
				<ProofSample />
			</Film>
		</>
	);
}

function ResponsiveFilm() {
	const [isOpen, setIsOpen] = useState(false);
	const isWide = useIsWide();
	return (
		<div className="space-y-4">
			<Button onClick={() => setIsOpen(true)}>Open the responsive film</Button>
			<Film
				title="Why"
				presentation={isWide ? "side" : "sheet"}
				open={isOpen}
				onClose={() => setIsOpen(false)}
			>
				<ProofSample />
				<MountProbe />
			</Film>
		</div>
	);
}

export const SHEET_FILM_SPECIMENS = [
	{ id: "sheet-paper", title: "Sheet" },
	{ id: "film-side", title: "Film, side" },
	{ id: "film-sheet", title: "Film, sheet" },
	{ id: "film-responsive", title: "Film across 1280 px" },
];

export function SheetFilmSection() {
	return (
		<section aria-labelledby="sheetfilm-heading" className="pt-16">
			<h2
				id="sheetfilm-heading"
				className="font-doc text-verdict font-semibold"
			>
				Sheet and Film
			</h2>

			<Specimen
				id="sheet-paper"
				title="Sheet"
				note="Paper with a hairline border and a 4 px radius, at most 680 px wide. A sheet set inside film is paper again."
			>
				<div className="space-y-6">
					<Sheet>
						<p className="font-doc text-doc-body">
							Answer a few questions. You get the amount the policy pays, each
							deduction, and the clause behind it.
						</p>
					</Sheet>
					<OnFilm>
						<Sheet>
							<p className="font-doc text-doc-body">A sheet inside film.</p>
						</Sheet>
					</OnFilm>
				</div>
			</Specimen>

			<Specimen
				id="film-side"
				title="Film, side"
				note="From 1280 px the film sits beside the sheet as a labelled section."
			>
				<div className="max-w-column">
					<SideFilm />
				</div>
			</Specimen>

			<Specimen
				id="film-sheet"
				title="Film, sheet"
				note="Below 1280 px the film rises from the bottom as a modal. Focus stays inside; Escape closes it."
			>
				<SheetFilm />
			</Specimen>

			<Specimen
				id="film-responsive"
				title="Film across 1280 px"
				note="Resize across 1280 px while it is open. The content moves between side and sheet without remounting."
			>
				<ResponsiveFilm />
			</Specimen>
		</section>
	);
}
