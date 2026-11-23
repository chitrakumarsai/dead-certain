import { expect, test } from "vitest";
import {
	type CommandItem,
	MAX_COMMANDS,
	matches,
	visibleCommands,
} from "./CommandMenu";

const item: CommandItem = {
	id: "rulebook",
	label: "Rulebook",
	group: "Pages",
	keywords: "policy clauses",
};

test("matches label, group and keywords, ignoring case and outer spaces", () => {
	expect(matches(item, "")).toBe(true);
	expect(matches(item, "  RULE ")).toBe(true);
	expect(matches(item, "pages")).toBe(true);
	expect(matches(item, "clauses")).toBe(true);
	expect(matches(item, "verdict")).toBe(false);
});

test("a list of 70 is cut to the first 60, in order", () => {
	const many: CommandItem[] = Array.from({ length: 70 }, (_, i) => ({
		id: `item-${i}`,
		label: `Item ${i}`,
		group: "Pages",
	}));
	const shown = visibleCommands(many, "");

	expect(MAX_COMMANDS).toBe(60);
	expect(shown).toHaveLength(60);
	expect(shown[0]?.id).toBe("item-0");
	expect(shown[59]?.id).toBe("item-59");
	expect(visibleCommands(many, "item 6")).toHaveLength(11);
});
