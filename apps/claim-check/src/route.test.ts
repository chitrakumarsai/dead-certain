import { describe, expect, it } from "vitest";
import { parseRoute } from "./route";

describe("parseRoute", () => {
	it("maps the three routes", () => {
		expect(parseRoute("")).toEqual({ page: "check" });
		expect(parseRoute("#/?r=abc")).toEqual({ page: "check" });
		expect(parseRoute("#/rulebook")).toEqual({
			page: "rulebook",
			clause: null,
		});
		expect(parseRoute("#/rulebook?clause=4.2")).toEqual({
			page: "rulebook",
			clause: "4.2",
		});
		expect(parseRoute("#/nowhere")).toEqual({ page: "notfound" });
	});
});
