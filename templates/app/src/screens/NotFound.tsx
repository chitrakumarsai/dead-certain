import { Sheet } from "@dead-certain/ui";
import { useEffect, useRef } from "react";
import { useTitle } from "../useTitle";

const HEADING = "Page not found";

/** An unknown route, with the way back. */
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
				There is nothing at this address.
			</p>
			<div className="pt-6">
				<a
					href="#/"
					className="inline-flex min-h-touch items-center text-sys-body underline underline-offset-4"
				>
					Go to the start
				</a>
			</div>
		</Sheet>
	);
}
