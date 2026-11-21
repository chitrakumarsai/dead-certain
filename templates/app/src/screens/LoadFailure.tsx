import { Sheet } from "@dead-certain/ui";

/** Shown when the compiled knowledge base is missing or malformed (requirement 5.2). */
export function LoadFailure() {
	return (
		<Sheet as="section" aria-labelledby="load-failure-heading">
			<h1 id="load-failure-heading" className="text-sys-body font-semibold">
				The rules did not load. Reload the page.
			</h1>
		</Sheet>
	);
}
