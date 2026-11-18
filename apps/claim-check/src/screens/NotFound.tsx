import { Sheet } from "@dead-certain/ui";
import { useEffect, useRef } from "react";
import { useTitle } from "../useTitle";

const HEADING = "Page not found";
const LINK =
	"inline-flex min-h-touch items-center text-sys-body underline underline-offset-4";

/** An unknown route, with the two ways back (requirement 12). */
export function NotFound() {
	useTitle(HEADING);
	const heading = useRef<HTMLHeadingElement>(null);
	useEffect(() => heading.current?.focus(), []);
	return (
		<Sheet as="section" aria-labelledby="notfound-heading">
			<h1
				id="notfound-heading"
				ref={heading}
				tabIndex={-1}
				className="font-doc text-verdict font-semibold"
			>
				{HEADING}
			</h1>
			<p className="max-w-column pt-4 text-sys-body">
				This page was not in the policy either.
			</p>
			<div className="flex flex-wrap gap-6 pt-6">
				<a href="#/" className={LINK}>
					Check a claim
				</a>
				<a href="#/rulebook" className={LINK}>
					Read the sample policy
				</a>
			</div>
		</Sheet>
	);
}
