import {
	FeatureCard,
	Illustration,
	type IllustrationName,
} from "@dead-certain/ui";
import { Specimen } from "./Specimen";

const STEPS: readonly [IllustrationName, string, string][] = [
	["rulebook", "Rulebook", "The policy, typeset with numbered clauses."],
	["rules", "Rules", "One rule per clause, each citing it."],
	["verdict", "Verdict", "The amount, each deduction and its clause."],
	["proof", "Proof", "The rules that fired and the facts they used."],
];

export const CARD_SPECIMENS = [
	{ id: "featurecard-plain", title: "FeatureCard" },
	{ id: "featurecard-effects", title: "FeatureCard with spotlight and shine" },
	{ id: "illustration-set", title: "Illustration" },
];

export function CardsSection() {
	return (
		<section aria-labelledby="cards-heading" className="pt-16">
			<h2 id="cards-heading" className="font-doc text-verdict font-semibold">
				FeatureCard and Illustration
			</h2>

			<Specimen
				id="featurecard-plain"
				title="FeatureCard"
				note="Radius 12, a decorative edge and the inset highlight. No grain: that belongs to film. Hover brightens the edge."
			>
				<div className="grid gap-4 md:grid-cols-3">
					<FeatureCard title="One question at a time">
						Only the questions that can change the amount are asked.
					</FeatureCard>
					<FeatureCard title="Every deduction cited">
						Each line shows the policy clause and the rule behind it.
					</FeatureCard>
					<FeatureCard title="Stays in your browser">
						The engine runs on this page. No account and no server.
					</FeatureCard>
				</div>
			</Specimen>

			<Specimen
				id="featurecard-effects"
				title="FeatureCard with spotlight and shine"
				note="Landing page and kit only. Hover: a wax spotlight follows the pointer and a shine crosses once. Under reduced motion both hold still."
			>
				<div className="grid gap-4 md:grid-cols-2">
					{STEPS.slice(0, 2).map(([name, title, body]) => (
						<FeatureCard
							key={name}
							title={title}
							illustration={<Illustration name={name} />}
							hasEffects
						>
							{body}
						</FeatureCard>
					))}
				</div>
			</Specimen>

			<Specimen
				id="illustration-set"
				title="Illustration"
				note="Inline SVG at 48 px with a 1.5 px stroke in currentColor, so each drawing follows the surface. Decorative: the label beside it names it."
			>
				<ul className="flex flex-wrap gap-8">
					{STEPS.map(([name, title]) => (
						<li key={name} className="flex flex-col items-center gap-2">
							<Illustration name={name} />
							<span className="text-sys-small text-text-soft">{title}</span>
						</li>
					))}
				</ul>
			</Specimen>
		</section>
	);
}
