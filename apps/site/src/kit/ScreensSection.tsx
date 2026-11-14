import { Framed } from "./AppShellSection";
import { Specimen } from "./Specimen";

/** The static screens, each its own page at kit/screen.html?screen=<name>. */
const SCREENS = [
	{
		name: "start",
		title: "Claim Check start",
		note: "What the check does, and the way in.",
	},
	{
		name: "question",
		title: "Claim Check question (money)",
		note: "One question with its reason and clause; the answers so far in the margin.",
	},
	{
		name: "verdict",
		title: "Claim Check verdict",
		note: "Paid in part: the headline, the bar, the ledger and what would change it.",
	},
] as const;

export const SCREEN_SPECIMENS = SCREENS.map(({ name, title }) => ({
	id: `screen-${name}`,
	title,
}));

export function ScreensSection() {
	return (
		<section aria-labelledby="screens-heading" className="pt-16">
			<h2 id="screens-heading" className="font-doc text-verdict font-semibold">
				Screens
			</h2>
			<p className="max-w-column pt-2 text-text-soft">
				Finished screens built only from kit components and sample data, the
				visual baseline for the two apps. Each is its own page; open it to see
				it at full width.
			</p>

			{SCREENS.map(({ name, title, note }) => (
				<Specimen key={name} id={`screen-${name}`} title={title} note={note}>
					<div className="space-y-2">
						<Framed
							src={`./screen.html?screen=${name}&preview=1`}
							title={`Dead Certain screen: ${title}`}
							height={720}
							// A preview: not usable in the frame. Open the screen to use it.
							isPreview
						/>
						<a
							href={`./screen.html?screen=${name}`}
							className="inline-flex min-h-touch items-center text-sys-small underline underline-offset-4"
						>
							Open {title} on its own
						</a>
					</div>
				</Specimen>
			))}
		</section>
	);
}
