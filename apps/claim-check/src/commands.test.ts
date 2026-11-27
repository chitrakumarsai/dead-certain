import { MAX_COMMANDS } from "@dead-certain/ui";
import { describe, expect, it, vi } from "vitest";
import { commandsFor } from "./commands";

const entry = (fact: string) => ({
	fact,
	label: `Label ${fact}`,
	display: `Value ${fact}`,
	value: 1,
});

describe("commandsFor (requirement 16.3)", () => {
	it("offers start over, copy link, the rulebook and each answer on a verdict", () => {
		const dispatch = vi.fn();
		const copy = vi.fn();
		const items = commandsFor({
			step: "verdict",
			answers: [entry("age"), entry("room_days")],
			dispatch,
			copy,
		});
		expect(items.map((i) => i.label)).toEqual([
			"Start over",
			"Copy link to this verdict",
			"Open the rulebook",
			"Change Label age",
			"Change Label room_days",
		]);
		expect(items.find((i) => i.label === "Open the rulebook")?.href).toBe(
			"#/rulebook",
		);
		items[0]?.onSelect?.();
		expect(dispatch).toHaveBeenLastCalledWith({ type: "restart" });
		items[1]?.onSelect?.();
		expect(copy).toHaveBeenCalledOnce();
		items[4]?.onSelect?.();
		expect(dispatch).toHaveBeenLastCalledWith({
			type: "edit",
			fact: "room_days",
		});
		expect(items[3]?.keywords).toContain("Value age");
		expect(new Set(items.map((i) => i.id)).size).toBe(items.length);
	});

	it("copies a link only on a verdict, and starts over only once started", () => {
		const base = { answers: [], dispatch: () => {}, copy: () => {} };
		const labels = (step: Parameters<typeof commandsFor>[0]["step"]) =>
			commandsFor({ ...base, step }).map((i) => i.label);
		expect(labels("start")).toEqual(["Open the rulebook"]);
		expect(labels("question")).toEqual(["Start over", "Open the rulebook"]);
		expect(labels("stale")).toEqual(["Start over", "Open the rulebook"]);
	});

	it("keeps the list within the menu's limit", () => {
		const answers = Array.from({ length: 100 }, (_, i) => entry(`f${i}`));
		const items = commandsFor({
			step: "verdict",
			answers,
			dispatch: () => {},
			copy: () => {},
		});
		expect(items).toHaveLength(MAX_COMMANDS);
	});
});
