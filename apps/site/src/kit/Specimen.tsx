import type { ReactNode } from "react";

interface SpecimenProps {
	/** `<component>-<state>` in kebab-case. Also the deep-link fragment. */
	id: string;
	title: string;
	/** One line saying what to look for. */
	note: string;
	children: ReactNode;
}

/** One state of one component, addressable by `#id`. */
export function Specimen({ id, title, note, children }: SpecimenProps) {
	return (
		<figure id={id} data-specimen={id} className="scroll-mt-6 pt-8">
			<h3 className="text-sys-body font-semibold">{title}</h3>
			{/* Specimens keep their paper ground on the lightbox in both themes
			    until ui-kit task 14 draws each component for the dark room. */}
			<div className="pt-4">
				<div data-surface="paper" className="bg-lightbox text-text">
					{children}
				</div>
			</div>
			<figcaption className="max-w-column pt-3 text-sys-small text-text-soft">
				{note}
			</figcaption>
		</figure>
	);
}
