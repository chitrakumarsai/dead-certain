import { Sheet } from "@dead-certain/ui";

/** GitHub Pages serves this for any unknown address (requirement 6.3). */
export function NotFound() {
	return (
		<Sheet as="section" aria-labelledby="notfound-heading">
			<h1 id="notfound-heading" className="font-doc text-verdict font-semibold">
				Page not found
			</h1>
			<p className="max-w-column pt-4 text-sys-body">
				Nothing at this address was decided, so nothing here needs a proof.
			</p>
			<p className="pt-6">
				<a
					href={import.meta.env.BASE_URL}
					className="inline-flex min-h-touch items-center text-sys-body underline underline-offset-4"
				>
					Go to the Dead Certain home page
				</a>
			</p>
		</Sheet>
	);
}
