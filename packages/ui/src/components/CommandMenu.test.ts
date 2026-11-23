import { expect, test } from "vitest";
import { type CommandItem, matches } from "./CommandMenu";

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
