import { Specimen } from "./Specimen";

/** The shell owns a page's landmarks and live region, so each one gets its own document. */
export function Framed({
	src,
	title,
	width,
	height = 560,
	isPreview = false,
}: {
	src: string;
	title: string;
	width?: number;
	height?: number;
	/** Inert: nothing inside can take focus from the gallery, or be used. */
	isPreview?: boolean;
}) {
	return (
		<iframe
			src={src}
			title={title}
			inert={isPreview}
			// Fixed sizes keep the gallery from shifting as each frame loads.
			style={{ width: width ?? "100%", maxWidth: "100%", height }}
			className="block rounded-paper border border-divider bg-surface"
		/>
	);
}

export const APP_SHELL_SPECIMENS = [
	{ id: "appshell-desktop", title: "Desktop with rail" },
	{ id: "appshell-phone-closed", title: "Phone, menu closed" },
	{ id: "appshell-phone-open", title: "Phone, menu open" },
];

export function AppShellSection() {
	return (
		<section aria-labelledby="appshell-heading" className="pt-16">
			<h2 id="appshell-heading" className="font-doc text-verdict font-semibold">
				AppShell
			</h2>
			<p className="max-w-column pt-2 text-text-soft">
				The frame every app shares. It owns the page's landmarks, skip link and
				live region, so each specimen is its own page in a frame.
			</p>

			<Specimen
				id="appshell-desktop"
				title="Desktop with rail"
				note="Wordmark and navigation in the header, the answers in the margin from 1024 px. Narrower galleries show the phone layout here."
			>
				<Framed
					src="./shell.html"
					title="Dead Certain shell, desktop with rail"
				/>
			</Specimen>
			<Specimen
				id="appshell-phone-closed"
				title="Phone, menu closed"
				note="Below 768 px the navigation sits behind Menu."
			>
				<Framed
					src="./shell.html?rail=no"
					title="Dead Certain shell, phone with the menu closed"
					width={390}
				/>
			</Specimen>
			<Specimen
				id="appshell-phone-open"
				title="Phone, menu open"
				note="Escape or following a link closes the menu."
			>
				<Framed
					src="./shell.html?rail=no&menu=open"
					title="Dead Certain shell, phone with the menu open"
					width={390}
				/>
			</Specimen>
		</section>
	);
}
