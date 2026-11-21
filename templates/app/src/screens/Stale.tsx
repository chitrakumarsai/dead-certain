import { type ReplayFailure, StaleLinkNotice } from "@dead-certain/ui";
import { useTitle } from "../useTitle";

/** A link that cannot be replayed shows no verdict and no question (requirement 5.7). */
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
			<h1 className="sr-only">__APP_TITLE__</h1>
			<StaleLinkNotice failure={failure} onStart={onStart} />
		</>
	);
}
