import * as Collapsible from "@radix-ui/react-collapsible";
import { type KeyboardEvent, type ReactNode, useRef, useState } from "react";
import { LiveRegion } from "../a11y/LiveRegion";
import { Close, Menu } from "../icons";
import { useMediaQuery } from "../useMediaQuery";

export interface AppShellProps {
	/** "Claim Check". */
	appName: string;
	nav: readonly { label: string; href: string; current?: boolean }[];
	/** The AnswersRail. It brings its own aside landmark, so none is added here. */
	rail?: ReactNode;
	/** Defaults to "No guesses were made in the production of this verdict." */
	footer?: ReactNode;
	children: ReactNode;
}

const PHONE = "(max-width: 767.98px)";
const DEFAULT_FOOTER =
	"No guesses were made in the production of this verdict.";

function NavList({
	nav,
	onNavigate,
}: Pick<AppShellProps, "nav"> & { onNavigate: () => void }) {
	return (
		<nav aria-label="Main">
			<ul className="flex flex-col gap-1 md:flex-row md:gap-4">
				{nav.map((item) => (
					<li key={item.href}>
						<a
							href={item.href}
							aria-current={item.current ? "page" : undefined}
							onClick={onNavigate}
							className="inline-flex min-h-touch items-center rounded-control px-2 text-sys-body text-text underline-offset-4 hover:underline aria-[current=page]:font-semibold aria-[current=page]:underline"
						>
							{item.label}
						</a>
					</li>
				))}
			</ul>
		</nav>
	);
}

/** Below 768 px the navigation sits behind "Menu"; Escape and navigation close it. */
function PhoneMenu({
	nav,
	brand,
}: Pick<AppShellProps, "nav"> & { brand: ReactNode }) {
	const [isOpen, setOpen] = useState(false);
	const triggerRef = useRef<HTMLButtonElement>(null);
	const closeOnEscape = (event: KeyboardEvent<HTMLDivElement>): void => {
		if (event.key !== "Escape" || !isOpen) return;
		setOpen(false);
		triggerRef.current?.focus();
	};
	return (
		<Collapsible.Root open={isOpen} onOpenChange={setOpen} asChild>
			{/* biome-ignore lint/a11y/noStaticElementInteractions: Escape anywhere in the open menu closes it. */}
			<div onKeyDown={closeOnEscape}>
				<div className="flex items-center justify-between gap-4">
					{brand}
					<Collapsible.Trigger
						ref={triggerRef}
						data-menu-trigger
						className="inline-flex min-h-touch items-center gap-2 rounded-control px-3 text-sys-body font-semibold text-text hover:bg-text/10"
					>
						{isOpen ? <Close /> : <Menu />}
						Menu
					</Collapsible.Trigger>
				</div>
				{/* Full width under the header row. */}
				<Collapsible.Content className="pt-2">
					<NavList nav={nav} onNavigate={() => setOpen(false)} />
				</Collapsible.Content>
			</div>
		</Collapsible.Root>
	);
}

function Frame({ appName, nav, rail, footer, children }: AppShellProps) {
	const isPhone = useMediaQuery(PHONE);
	const mainRef = useRef<HTMLElement>(null);
	const brand = (
		<p className="flex items-baseline gap-3">
			<span className="font-doc text-sys-body font-semibold text-text">
				Dead Certain
			</span>
			<span className="text-sys-body text-text-soft">{appName}</span>
		</p>
	);

	return (
		<div className="flex min-h-screen flex-col">
			{/* biome-ignore lint/a11y/useValidAnchor: a skip link stays a link; the apps route in the hash, so it moves focus without changing it. */}
			<a
				href="#content"
				onClick={(event) => {
					event.preventDefault();
					mainRef.current?.focus();
				}}
				className="sr-only rounded-control bg-surface text-sys-body text-text focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:inline-flex focus:min-h-touch focus:items-center focus:px-3"
			>
				Skip to the content
			</a>
			<header className="border-b border-divider px-4 py-2 md:px-6">
				{isPhone ? (
					<PhoneMenu nav={nav} brand={brand} />
				) : (
					<div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
						{brand}
						<NavList nav={nav} onNavigate={() => undefined} />
					</div>
				)}
			</header>
			{/* Below 1024 px the rail is a disclosure above the content. */}
			<div className="flex flex-1 flex-col gap-6 px-4 py-6 md:px-6 lg:flex-row lg:items-start">
				{rail && (
					<div data-rail-slot className="shrink-0">
						{rail}
					</div>
				)}
				<main
					ref={mainRef}
					id="content"
					tabIndex={-1}
					data-focus-ring="frame"
					className="min-w-0 flex-1"
				>
					{children}
				</main>
			</div>
			<footer className="border-t border-divider px-4 py-4 text-sys-small text-text-soft md:px-6">
				{footer ?? DEFAULT_FOOTER}
			</footer>
		</div>
	);
}

/**
 * The frame every app shares: skip link, header with the wordmark and
 * navigation, the rail, main and the footer. It hosts the page's single
 * polite live region, so anything inside can call useAnnounce().
 */
export function AppShell(props: AppShellProps) {
	return (
		<LiveRegion>
			<Frame {...props} />
		</LiveRegion>
	);
}
