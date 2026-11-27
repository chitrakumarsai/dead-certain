import { Button } from "@dead-certain/ui";
import { createContext, useCallback, useContext, useState } from "react";

type Copied = "idle" | "copied" | "by-hand";

export interface CopyLinkState {
	state: Copied;
	link: string;
	copy: () => Promise<void>;
	/** Back to idle, when the step changes. */
	reset: () => void;
}

/** The app's one copy-link state, shared by the verdict's button and the command menu. */
export function useCopyLinkState(): CopyLinkState {
	const [state, setState] = useState<Copied>("idle");
	const [link, setLink] = useState("");
	const copy = useCallback(async () => {
		const href = location.href;
		setLink(href);
		try {
			await navigator.clipboard.writeText(href);
			setState("copied");
		} catch {
			setState("by-hand");
		}
	}, []);
	const reset = useCallback(() => setState("idle"), []);
	return { state, link, copy, reset };
}

export const CopyLinkContext = createContext<CopyLinkState | null>(null);

/**
 * "Copy link to this verdict", with a by-hand fallback (requirements 10.5,
 * 10.6). "Link copied" is the app's Toast (16.4).
 */
export function CopyLink() {
	const shared = useContext(CopyLinkContext);
	if (!shared) throw new Error("CopyLink needs a CopyLinkContext above it");
	const { state, link, copy } = shared;
	return (
		<div className="flex flex-col gap-2">
			<Button id={COPY_BUTTON_ID} onClick={copy}>
				Copy link to this verdict
			</Button>
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

/** Where focus goes when the toast's Dismiss button goes away. */
export const COPY_BUTTON_ID = "copy-link";
