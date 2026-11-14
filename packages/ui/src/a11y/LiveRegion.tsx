import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useState,
} from "react";

type Announce = (message: string) => void;

const AnnounceContext = createContext<Announce | null>(null);

/**
 * Hosts the page's single polite live region. Wrap the app once, at the
 * AppShell, and announce with `useAnnounce()`.
 */
export function LiveRegion({ children }: { children: ReactNode }) {
	// The counter makes a repeated message a new render, so it is read again.
	const [{ message, count }, setState] = useState({ message: "", count: 0 });
	const announce = useCallback<Announce>((next) => {
		setState((prev) => ({ message: next, count: prev.count + 1 }));
	}, []);

	return (
		<AnnounceContext.Provider value={announce}>
			{children}
			<div aria-live="polite" role="status" className="sr-only">
				<span key={count}>{message}</span>
			</div>
		</AnnounceContext.Provider>
	);
}

/** Announces a message through the page's live region. */
export function useAnnounce(): Announce {
	const announce = useContext(AnnounceContext);
	if (!announce) {
		throw new Error(
			"useAnnounce needs a <LiveRegion> above it, at the AppShell",
		);
	}
	return announce;
}
