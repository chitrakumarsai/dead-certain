import { expect, test } from "vitest";
import { ANSWER_MESSAGES } from "./components/answerMessages";

test("messages are plain sentences with no apology", () => {
	const all = Object.values(ANSWER_MESSAGES);

	expect(all).toEqual(expect.arrayContaining(["Choose one answer."]));
	for (const message of all) {
		expect(message).toMatch(/^[A-Z][^!]*\.$/);
		expect(message.toLowerCase()).not.toMatch(
			/sorry|please|oops|unfortunately/,
		);
	}
});
