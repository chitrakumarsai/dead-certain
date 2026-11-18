import { type ReplayFailure, StaleLinkNotice } from "@dead-certain/ui";
import { useTitle } from "../useTitle";

/** A link that cannot be replayed shows no verdict and no question (requirement 11). */
export function Stale({
	failure,
	onStart,
}: {
	failure: ReplayFailure;
	onStart: () => void;
}) {
	useTitle("This link cannot be replayed");
	return (
		<>
			<h1 className="sr-only">Check a hospital claim</h1>
			<StaleLinkNotice
				failure={failure}
				onStart={onStart}
				{...(failure === "KB_MISMATCH" ? { rulebookHref: "#/rulebook" } : {})}
			/>
		</>
	);
}
