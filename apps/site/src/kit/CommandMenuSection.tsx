import { type CommandItem, CommandMenu } from "@dead-certain/ui";
import { Specimen } from "./Specimen";

export const COMMAND_MENU_SPECIMENS = [
	{ id: "commandmenu-gallery", title: "CommandMenu over this gallery" },
];

/** The page's one CommandMenu: two would both answer Ctrl+K. */
export function CommandMenuSection({
	items,
}: {
	items: readonly CommandItem[];
}) {
	return (
		<section aria-labelledby="commandmenu-heading" className="pt-16">
			<h2
				id="commandmenu-heading"
				className="font-doc text-verdict font-semibold"
			>
				CommandMenu
			</h2>
			<Specimen
				id="commandmenu-gallery"
				title="CommandMenu over this gallery"
				note="Open it with the trigger, Ctrl+K or Cmd+K. It lists every section of this page; type to filter, Enter to go, Escape to close. The framed AppShell shows it in the header."
			>
				<CommandMenu items={items} />
			</Specimen>
		</section>
	);
}
