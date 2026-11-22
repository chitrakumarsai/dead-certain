import { Sheet } from "@dead-certain/ui";
import { links } from "./config";

export const SAMPLE_FAILED =
	"The sample verdict could not be loaded. Reload the page, or open Claim Check to see a verdict.";

/** In place of the hero's verdict when the data does not fit (requirements 1.4, 8.6). */
export function SampleFailed() {
	return (
		<Sheet as="section" aria-labelledby="sample-failed">
			<h2 id="sample-failed" className="text-sys-body font-semibold">
				{SAMPLE_FAILED}
			</h2>
			<p className="pt-4">
				<a
					href={links.claimCheck}
					className="inline-flex min-h-touch items-center text-sys-body underline underline-offset-4"
				>
					Open Claim Check
				</a>
			</p>
		</Sheet>
	);
}
