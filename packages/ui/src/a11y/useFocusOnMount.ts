import { type RefObject, useEffect } from "react";

/**
 * Focuses the element when it mounts and whenever `key` changes, so a new
 * question or verdict heading becomes the reader's position.
 */
export function useFocusOnMount(
	ref: RefObject<HTMLElement | null>,
	key?: unknown,
): void {
	// biome-ignore lint/correctness/useExhaustiveDependencies: key is the trigger, not a value the effect reads.
	useEffect(() => {
		ref.current?.focus();
	}, [ref, key]);
}
