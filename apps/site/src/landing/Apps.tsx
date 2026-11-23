import { links } from "./config";

const APPS = [
	{
		name: "Claim Check",
		href: links.claimCheck,
		does: "Works out how much of a hospital bill a sample health policy pays, with the clause behind every deduction.",
		mode: "Consultation: a policyholder answers questions and gets the amount paid.",
	},
	{
		name: "Pre-Flight",
		href: links.preFlight,
		does: "Checks a public GitHub repository against a submission checklist, with the rule and evidence behind each check.",
		mode: "Audit: a developer submits a public GitHub repository and gets pass or fail for each checklist item.",
	},
];

/** The two apps on the same engine (requirement 5.1). */
export function Apps() {
	return (
		<section data-print-hide aria-labelledby="apps-heading" className="pt-24">
			<h2
				id="apps-heading"
				className="text-center font-doc text-h2 font-semibold"
			>
				Two apps on the same engine
			</h2>
			<div className="grid gap-4 pt-12 md:grid-cols-2">
				{APPS.map((app) => (
					<article
						key={app.name}
						className="relative flex flex-col gap-3 rounded-card border border-border-default bg-surface-2 p-8 highlight-inset transition-colors duration-(--dur-hover) ease-kit has-[a:hover]:border-wax"
					>
						<h3 className="font-doc text-h2 font-semibold">
							{/* The whole card is the link's target; the name stays the link. */}
							<a
								href={app.href}
								className="inline-flex min-h-touch items-center after:absolute after:inset-0 after:rounded-card"
							>
								{app.name}
							</a>
						</h3>
						<p className="text-sys-body text-text-secondary">{app.does}</p>
						<p className="text-sys-small text-text-tertiary">{app.mode}</p>
					</article>
				))}
			</div>
		</section>
	);
}
