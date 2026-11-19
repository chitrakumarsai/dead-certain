import { Button, useAnnounce } from "@dead-certain/ui";
import { useEffect, useRef, useState } from "react";

/** "Copy report as Markdown", with a by-hand fallback when the clipboard refuses (10.1 to 10.3). */
export function CopyMarkdown({ text }: { text: () => string }) {
	const [byHand, setByHand] = useState<string | null>(null);
	const area = useRef<HTMLTextAreaElement>(null);
	const announce = useAnnounce();
	useEffect(() => {
		if (byHand !== null) area.current?.select();
	}, [byHand]);

	const copy = async () => {
		const markdown = text();
		try {
			await navigator.clipboard.writeText(markdown);
			setByHand(null);
			announce("Report copied");
		} catch {
			setByHand(markdown);
		}
	};

	return (
		<div className="flex flex-col gap-2">
			<div>
				<Button onClick={copy}>Copy report as Markdown</Button>
			</div>
			{byHand !== null && (
				<label className="flex flex-col gap-1 text-sys-small">
					Copy this text by hand.
					<textarea
						ref={area}
						readOnly
						rows={12}
						value={byHand}
						onFocus={(event) => event.currentTarget.select()}
						className="rounded-control border border-divider bg-surface p-2 font-mono text-mono text-text"
					/>
				</label>
			)}
		</div>
	);
}
