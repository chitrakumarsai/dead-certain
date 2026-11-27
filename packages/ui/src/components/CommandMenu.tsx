import * as Dialog from "@radix-ui/react-dialog";
import { type KeyboardEvent, useEffect, useId, useRef, useState } from "react";
import { useAnnounce } from "../a11y/LiveRegion";
import { Kbd } from "./Kbd";

export interface CommandItem {
	id: string;
	label: string;
	/** Printed beside the label: "Pages", "Sections". */
	group: string;
	/** Followed on Enter. */
	href?: string;
	/** Run on Enter, after the menu closes. */
	onSelect?: () => void;
	/** Extra words the filter matches. */
	keywords?: string;
}

export interface CommandMenuProps {
	items: readonly CommandItem[];
}

/** The filter is by hand, so the list stays short (requirement 36.5). */
export const MAX_COMMANDS = 60;

const isApple = () =>
	typeof navigator !== "undefined" &&
	/Mac|iPhone|iPad/.test(navigator.platform);

export const matches = (item: CommandItem, query: string): boolean =>
	`${item.label} ${item.group} ${item.keywords ?? ""}`
		.toLowerCase()
		.includes(query.trim().toLowerCase());

/** The items the menu shows for a query: matches in order, at most MAX_COMMANDS. */
export const visibleCommands = (
	items: readonly CommandItem[],
	query: string,
): CommandItem[] =>
	items.filter((item) => matches(item, query)).slice(0, MAX_COMMANDS);

const countSentence = (n: number): string =>
	n === 0 ? "No results" : n === 1 ? "1 result" : `${n} results`;

/**
 * A "Go to" dialog: a combobox over a listbox. Ctrl+K or Cmd+K opens it from
 * anywhere, arrows move, Enter goes, Escape closes and focus returns.
 */
export function CommandMenu({ items }: CommandMenuProps) {
	const [isOpen, setOpen] = useState(false);
	const [query, setQuery] = useState("");
	const [active, setActive] = useState(0);
	const announce = useAnnounce();
	const listId = useId();
	const optionId = (i: number) => `${listId}-${i}`;
	const isFirstCount = useRef(true);

	const shown = visibleCommands(items, query);
	const current = Math.min(active, Math.max(shown.length - 1, 0));

	useEffect(() => {
		const onKey = (event: globalThis.KeyboardEvent) => {
			if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "k")
				return;
			event.preventDefault();
			setOpen((was) => !was);
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, []);

	// The count is announced as the query changes, not when the menu opens.
	useEffect(() => {
		if (!isOpen) {
			isFirstCount.current = true;
			return;
		}
		if (isFirstCount.current) {
			isFirstCount.current = false;
			return;
		}
		announce(countSentence(shown.length));
	}, [isOpen, shown.length, announce]);

	const change = (next: boolean) => {
		setOpen(next);
		setQuery("");
		setActive(0);
	};

	// The chosen item runs once focus is back on the trigger, so an item that
	// moves focus (a reopened question, a new page) is not undone by the return.
	const chosen = useRef<CommandItem | null>(null);
	const triggerRef = useRef<HTMLButtonElement>(null);
	const choose = (item: CommandItem | undefined) => {
		if (item === undefined) return;
		chosen.current = item;
		change(false);
	};
	const runChosen = (event: Event) => {
		const item = chosen.current;
		chosen.current = null;
		if (item === null) return;
		event.preventDefault();
		triggerRef.current?.focus();
		item.onSelect?.();
		if (item.href !== undefined) location.assign(item.href);
	};

	const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
		const last = shown.length - 1;
		const moves: Record<string, number> = {
			ArrowDown: current >= last ? 0 : current + 1,
			ArrowUp: current <= 0 ? last : current - 1,
			Home: 0,
			End: last,
		};
		if (event.key in moves && shown.length > 0) {
			event.preventDefault();
			setActive(moves[event.key] as number);
			document
				.getElementById(optionId(moves[event.key] as number))
				?.scrollIntoView({ block: "nearest" });
		} else if (event.key === "Enter") {
			event.preventDefault();
			choose(shown[current]);
		}
	};

	const shortcut = isApple() ? "⌘K" : "Ctrl K";
	return (
		<Dialog.Root open={isOpen} onOpenChange={change}>
			<Dialog.Trigger
				ref={triggerRef}
				data-command-trigger
				aria-keyshortcuts="Meta+K Control+K"
				className="inline-flex min-h-touch min-w-touch items-center gap-3 rounded-control border border-border-strong px-3 text-sys-small text-text-soft transition-colors duration-(--dur-hover) ease-kit hover:bg-surface-3 hover:text-text"
			>
				Go to
				<Kbd>{shortcut}</Kbd>
			</Dialog.Trigger>
			<Dialog.Portal>
				<Dialog.Overlay className="fixed inset-0 bg-bg-base/70 transition-opacity duration-(--dur-menu) ease-kit starting:opacity-0" />
				<Dialog.Content
					onCloseAutoFocus={runChosen}
					className="fixed inset-x-4 top-24 mx-auto max-w-column rounded-card border border-border-strong bg-surface-2 text-text-primary halo-paper transition-opacity duration-(--dur-menu) ease-kit starting:opacity-0"
				>
					<Dialog.Title className="sr-only">Go to</Dialog.Title>
					<Dialog.Description className="sr-only">
						Type to filter. Arrows move through the results and Enter opens one.
					</Dialog.Description>
					<input
						type="text"
						role="combobox"
						aria-label="Go to"
						aria-expanded="true"
						aria-controls={listId}
						aria-autocomplete="list"
						aria-activedescendant={
							shown.length > 0 ? optionId(current) : undefined
						}
						autoComplete="off"
						spellCheck={false}
						placeholder="Go to a page or section"
						value={query}
						onChange={(event) => {
							setQuery(event.target.value);
							setActive(0);
						}}
						onKeyDown={onKeyDown}
						className="min-h-touch w-full rounded-t-card border-b border-border-default bg-transparent px-4 py-3 text-sys-body text-text-primary placeholder:text-text-tertiary focus-visible:outline-none"
					/>
					<div
						id={listId}
						role="listbox"
						aria-label="Results"
						className="max-h-[60vh] overflow-y-auto p-2"
					>
						{shown.map((item, i) => (
							// biome-ignore lint/a11y/useFocusableInteractive: focus stays in the combobox; aria-activedescendant points here.
							<div
								key={item.id}
								id={optionId(i)}
								role="option"
								aria-selected={i === current}
								onClick={() => choose(item)}
								onKeyDown={() => undefined}
								onMouseMove={() => setActive(i)}
								className="flex min-h-touch cursor-pointer items-center justify-between gap-4 rounded-control px-3 text-sys-body aria-selected:bg-surface-3"
							>
								<span>{item.label}</span>
								<span className="text-sys-small text-text-secondary">
									{item.group}
								</span>
							</div>
						))}
					</div>
					{shown.length === 0 && (
						<p className="px-4 pb-4 text-sys-small text-text-secondary">
							Nothing matches. Try fewer letters.
						</p>
					)}
				</Dialog.Content>
			</Dialog.Portal>
		</Dialog.Root>
	);
}
