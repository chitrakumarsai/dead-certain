import { describe, expect, it } from "vitest";
import { parseRoute } from "./route";

describe("parseRoute", () => {
	it("maps the check route and everything else to not found", () => {
		expect(parseRoute("")).toEqual({ page: "check" });
		expect(parseRoute("#/")).toEqual({ page: "check" });
		expect(parseRoute("#/?r=abc")).toEqual({ page: "check" });
		expect(parseRoute("#/nowhere")).toEqual({ page: "notfound" });
	});
});
