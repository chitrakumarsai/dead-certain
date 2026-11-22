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
		<section aria-labelledby="apps-heading" className="max-w-column pt-16">
			<h2 id="apps-heading" className="font-doc text-question font-semibold">
				Two apps on the same engine
			</h2>
			<div className="grid gap-6 pt-6 md:grid-cols-2">
				{APPS.map((app) => (
					<article
						key={app.name}
						className="space-y-2 rounded-paper border border-divider bg-surface p-6"
					>
						<h3 className="text-sys-body font-semibold">
							<a
								href={app.href}
								className="inline-flex min-h-touch items-center underline underline-offset-4"
							>
								{app.name}
							</a>
						</h3>
						<p className="text-sys-body">{app.does}</p>
						<p className="text-sys-small text-text-soft">{app.mode}</p>
					</article>
				))}
			</div>
		</section>
	);
}
