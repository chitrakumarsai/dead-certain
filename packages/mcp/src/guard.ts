import { EngineError } from "@dead-certain/engine";
import { fail, type ToolResult } from "./payload";

declare const process: { stderr: { write(text: string): unknown } };

/**
 * Run a tool body and never let an exception out (requirement 6.2). An
 * EngineError keeps its code and message. Anything else becomes INTERNAL with
 * a fixed sentence; only the error's name goes to standard error, never its
 * message, its stack or the arguments.
 */
export function guard(run: () => ToolResult): ToolResult {
	try {
		return run();
	} catch (error) {
		if (error instanceof EngineError) return fail(error.code, error.message);
		try {
			const name = error instanceof Error ? error.name : typeof error;
			process.stderr.write(`dead-certain mcp: internal error (${name})\n`);
		} catch {
			// Nothing more can be done.
		}
		return fail("INTERNAL", "The server could not complete this call.");
	}
}
