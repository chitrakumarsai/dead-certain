import { useEffect, useRef } from "react";
import { useAnnounce } from "../a11y/LiveRegion";
import { useFocusOnMount } from "../a11y/useFocusOnMount";
import { InfoCircle } from "../icons";
import type { ReplayFailure } from "../types";
import { Button } from "./Button";

export interface StaleLinkNoticeProps {
	failure: ReplayFailure;
	onStart: () => void;
	/** Offered for KB_MISMATCH when present. */
	rulebookHref?: string;
}

interface Copy {
	heading: string;
	body: string;
}

/**
 * Kit-owned copy for every replay failure. A new code in ReplayFailure without
 * copy here fails to compile. The engine's own message is never shown.
 */
const COPY: Readonly<Record<ReplayFailure, Copy>> = {
	KB_MISMATCH: {
		heading: "This link was made with older rules",
		body: "The rules have changed since this link was made, so the verdict cannot be replayed. Start the check again to get a verdict under the current rules.",
	},
	MALFORMED_TOKEN: {
		heading: "This link is incomplete or damaged",
		body: "Check that the whole link was copied, then open it again. Or start the check again.",
	},
	UNSUPPORTED_VERSION: {
		heading: "This link comes from a different version",
		body: "This version of the app cannot read it. Start the check again.",
	},
};

/**
 * What a verdict link that cannot be replayed shows instead of the verdict:
 * a neutral state inside main, not a modal and not an alert. A stale link is
 * not a denial, so it is never drawn in the denial colour.
 */
export function StaleLinkNotice({
	failure,
	onStart,
	rulebookHref,
}: StaleLinkNoticeProps) {
	const { heading, body } = COPY[failure];
	const headingRef = useRef<HTMLHeadingElement>(null);
	const announce = useAnnounce();
	const showRules = failure === "KB_MISMATCH" && rulebookHref !== undefined;

	useFocusOnMount(headingRef);
	useEffect(() => {
		announce(heading);
	}, [announce, heading]);

	return (
		// A state inside main, not a landmark: no accessible name on the section.
		<section className="max-w-column">
			<div className="flex items-start gap-3">
				<span data-notice-icon className="pt-1 text-text-soft">
					<InfoCircle />
				</span>
				<div className="min-w-0">
					<h2
						ref={headingRef}
						tabIndex={-1}
						className="font-doc text-question font-semibold text-text"
					>
						{heading}
					</h2>
					<p className="pt-2 text-sys-body text-text">{body}</p>
					<div className="flex flex-wrap items-center gap-4 pt-6">
						<Button variant="primary" onClick={onStart}>
							Start the check
						</Button>
						{showRules && (
							<a
								href={rulebookHref}
								className="inline-flex min-h-touch items-center text-sys-body text-text underline underline-offset-4"
							>
								Read the rules
							</a>
						)}
					</div>
				</div>
			</div>
		</section>
	);
}
