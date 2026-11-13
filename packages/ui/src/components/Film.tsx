import * as Dialog from "@radix-ui/react-dialog";
import {
	type ReactNode,
	type RefObject,
	useCallback,
	useId,
	useRef,
	useState,
} from "react";
import { createPortal } from "react-dom";
import { Button } from "./Button";

export interface FilmProps {
	/** The panel title, such as "Why". */
	title: string;
	/** "side" sits in the layout; "sheet" is a modal from the bottom. */
	presentation: "side" | "sheet";
	open: boolean;
	onClose: () => void;
	children: ReactNode;
}

function FilmHeader({
	title,
	titleId,
	headingRef,
	isDialog,
	onClose,
}: {
	title: string;
	titleId: string;
	headingRef: RefObject<HTMLHeadingElement | null>;
	isDialog: boolean;
	onClose: () => void;
}) {
	const heading = (
		<h2
			// In the dialog, Radix's Title supplies the id the dialog is labelled
			// by. Even id={undefined} would override it, so the prop is left out.
			{...(isDialog ? {} : { id: titleId })}
			ref={headingRef}
			tabIndex={-1}
			className="font-doc text-question font-semibold"
		>
			{title}
		</h2>
	);
	return (
		<div className="flex items-center justify-between gap-4 pb-4">
			{isDialog ? <Dialog.Title asChild>{heading}</Dialog.Title> : heading}
			<Button variant="quiet" onClick={onClose}>
				Close
			</Button>
		</div>
	);
}

const FILM_CLASS = "bg-surface p-4 text-text md:p-6";

/**
 * The dark proof surface. The children are rendered once into a node that
 * moves between the side panel and the bottom sheet, so switching
 * presentation (a resize across 1280 px) never remounts them.
 */
export function Film({
	title,
	presentation,
	open,
	onClose,
	children,
}: FilmProps) {
	const titleId = useId();
	const headingRef = useRef<HTMLHeadingElement>(null);
	// Where focus was when the sheet opened, so closing can put it back.
	const openerRef = useRef<HTMLElement | null>(null);
	const [host] = useState(() =>
		typeof document === "undefined" ? null : document.createElement("div"),
	);
	const attach = useCallback(
		(slot: HTMLDivElement | null) => {
			if (slot && host && host.parentElement !== slot) slot.appendChild(host);
		},
		[host],
	);

	const header = (
		<FilmHeader
			title={title}
			titleId={titleId}
			headingRef={headingRef}
			isDialog={presentation === "sheet"}
			onClose={onClose}
		/>
	);
	// Always first, so a switch between side and sheet keeps it mounted.
	const content = open && host ? createPortal(children, host) : null;

	if (presentation === "side") {
		return open ? (
			<>
				{content}
				<section
					aria-labelledby={titleId}
					data-surface="film"
					className={`rounded-film ${FILM_CLASS}`}
				>
					{header}
					<div ref={attach} />
				</section>
			</>
		) : null;
	}

	return (
		<>
			{content}
			<Dialog.Root open={open} onOpenChange={(next) => next || onClose()}>
				<Dialog.Portal>
					<Dialog.Overlay
						data-film-scrim
						className="fixed inset-0 bg-film/70"
					/>
					<Dialog.Content
						aria-describedby={undefined}
						data-surface="film"
						onOpenAutoFocus={(event) => {
							event.preventDefault();
							openerRef.current =
								document.activeElement instanceof HTMLElement
									? document.activeElement
									: null;
							headingRef.current?.focus();
						}}
						onCloseAutoFocus={(event) => {
							event.preventDefault();
							const opener = openerRef.current;
							if (opener?.isConnected) opener.focus();
						}}
						className={`fixed inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-film ${FILM_CLASS}`}
					>
						{header}
						<div ref={attach} />
					</Dialog.Content>
				</Dialog.Portal>
			</Dialog.Root>
		</>
	);
}
