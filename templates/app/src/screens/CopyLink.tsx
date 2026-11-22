import { Button, useAnnounce } from "@dead-certain/ui";
import { useState } from "react";

type Copied = "idle" | "copied" | "by-hand";

/** "Copy link to this verdict", with a by-hand fallback. */
export function CopyLink() {
	const [state, setState] = useState<Copied>("idle");
	const [link, setLink] = useState("");
	const announce = useAnnounce();

	const copy = async () => {
		const href = location.href;
		setLink(href);
		try {
			await navigator.clipboard.writeText(href);
			setState("copied");
			announce("Link copied");
		} catch {
			setState("by-hand");
		}
	};

	return (
		<div className="flex flex-col gap-2">
			<Button onClick={copy}>Copy link to this verdict</Button>
			{state === "copied" && (
				<p className="font-mono text-mono wrap-anywhere text-text-soft">
					{link}
				</p>
			)}
			{state === "by-hand" && (
				<label className="flex flex-col gap-1 text-sys-small">
					Copy this link by hand.
					<input
						readOnly
						value={link}
						onFocus={(event) => event.currentTarget.select()}
						className="min-h-touch rounded-control border border-divider bg-surface px-2 font-mono text-mono text-text"
					/>
				</label>
			)}
		</div>
	);
}
