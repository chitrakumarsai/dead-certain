import { Button, useAnnounce } from "@dead-certain/ui";
import { useEffect, useRef, useState } from "react";
import { README_SECTION_URL } from "./config";

export const COMMAND = "pnpm new-app my-app";
const UNAVAILABLE = "Copy unavailable. The command is selected.";
const CODE =
	"rounded-control border border-border-strong bg-bg-base px-4 py-3 font-mono text-mono";

/** The command that scaffolds a third app, and Copy command (requirements 5.3, 5.4). */
export function Scaffold() {
	const announce = useAnnounce();
	const [fallback, setFallback] = useState(false);
	const selectRef = useRef<HTMLElement>(null);

	// No clipboard, or permission refused: the command is shown selected, to copy by hand.
	useEffect(() => {
		const node = selectRef.current;
		if (!fallback || node === null) return;
		const range = document.createRange();
		range.selectNodeContents(node);
		window.getSelection()?.removeAllRanges();
		window.getSelection()?.addRange(range);
	}, [fallback]);

	const copy = async () => {
		try {
			await navigator.clipboard.writeText(COMMAND);
			setFallback(false);
			announce("Copied");
		} catch {
			setFallback(true);
			announce(UNAVAILABLE);
		}
	};

	return (
		<section
			data-print-hide
			aria-labelledby="scaffold-heading"
			className="my-24 rounded-card border border-border-default bg-surface-1 p-8 md:p-12"
		>
			<h2 id="scaffold-heading" className="font-doc text-h2 font-semibold">
				Build a third app
			</h2>
			<p className="max-w-column pt-4 text-sys-body text-text-secondary">
				The two apps share a skeleton. One command creates a third app from the
				template, with a starter rulebook you replace with your own.
			</p>
			<div className="flex flex-wrap items-center gap-4 pt-6">
				<code className={CODE}>pnpm new-app &lt;name&gt;</code>
				<Button onClick={copy}>Copy command</Button>
			</div>
			{fallback && (
				<div className="space-y-2 pt-4">
					<p className="text-sys-small">{UNAVAILABLE}</p>
					<code ref={selectRef} className={`block ${CODE}`}>
						{COMMAND}
					</code>
				</div>
			)}
			<p className="pt-6">
				<a
					href={README_SECTION_URL}
					className="inline-flex min-h-touch items-center text-sys-body underline underline-offset-4"
				>
					Read "Add a third app" in the README
				</a>
			</p>
		</section>
	);
}
