import { Button, useAnnounce } from "@dead-certain/ui";
import { useEffect, useRef } from "react";
import type { CollectError } from "../../collectors/parse";
import type { Target } from "../../collectors/types";
import { SAMPLES } from "../run/samples";

const resetTime = (resetAt: number) =>
	new Intl.DateTimeFormat(undefined, {
		hour: "2-digit",
		minute: "2-digit",
	}).format(new Date(resetAt * 1000));

/** The four errors of requirement 8, each in plain words with its way on. */
function copyFor(error: CollectError): { heading: string; body?: string } {
	switch (error.kind) {
		case "not_found":
			return {
				heading:
					"This repository is private or does not exist. Pre-Flight reads public repositories only.",
			};
		case "rate_limited":
			return {
				heading: "GitHub's limit for this browser is used up.",
				body:
					error.resetAt === undefined
						? "Try again in about an hour."
						: `Try again after ${resetTime(error.resetAt)}.`,
			};
		case "unreachable":
			return {
				heading:
					"Pre-Flight could not reach GitHub. Check your connection and try again.",
			};
		case "unreadable":
			return {
				heading:
					"GitHub sent a response Pre-Flight could not read. Try again later.",
			};
	}
}

export function ErrorScreen({
	error,
	target,
	onRetry,
}: {
	error: CollectError;
	target: Target;
	onRetry: () => void;
}) {
	const heading = useRef<HTMLHeadingElement>(null);
	const announce = useAnnounce();
	const { heading: text, body } = copyFor(error);
	useEffect(() => {
		heading.current?.focus();
		announce(body === undefined ? text : `${text} ${body}`);
	}, [announce, text, body]);
	const sameSample = SAMPLES.find(
		(s) => s.target.owner === target.owner && s.target.name === target.name,
	);
	return (
		<section aria-labelledby="error-heading" className="pt-6">
			<h2
				id="error-heading"
				ref={heading}
				tabIndex={-1}
				className="max-w-column text-sys-body font-semibold"
			>
				{text}
			</h2>
			{body && <p className="pt-2 text-sys-body">{body}</p>}
			<div className="flex flex-wrap gap-3 pt-4">
				{error.kind === "not_found" && (
					<Button variant="primary" onClick={() => (location.hash = "#/")}>
						Check another repository
					</Button>
				)}
				{(error.kind === "unreachable" || error.kind === "unreadable") && (
					<Button variant="primary" onClick={onRetry}>
						Try again
					</Button>
				)}
				{error.kind === "rate_limited" && sameSample && (
					<Button
						variant="primary"
						onClick={() => (location.hash = `#/report?sample=${sameSample.id}`)}
					>
						{`Use the snapshot of ${sameSample.target.owner}/${sameSample.target.name}`}
					</Button>
				)}
				{error.kind === "rate_limited" &&
					SAMPLES.filter((s) => s !== sameSample).map((s) => (
						<Button
							key={s.id}
							variant="secondary"
							onClick={() => (location.hash = `#/report?sample=${s.id}`)}
						>
							{`${s.target.owner}/${s.target.name}`}
						</Button>
					))}
			</div>
		</section>
	);
}
