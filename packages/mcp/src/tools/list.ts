import { guard } from "../guard";
import { compileFile } from "../kbs";
import { fail, type JsonObject, ok, type ToolResult } from "../payload";
import type { Workspace } from "../workspace";

/** `list_kbs`: every discovered knowledge base and whether it compiles. */
export function listKbs(ws: Workspace): ToolResult {
	return guard(() => {
		if (ws.root() === undefined) {
			return fail(
				"NO_WORKSPACE",
				"No pnpm-workspace.yaml above the working directory.",
			);
		}
		const kbs = ws.listKbFiles().map((file): JsonObject => {
			const outcome = compileFile(ws, file);
			if (outcome.kind === "ok") {
				const kb = outcome.kb;
				const facts = Object.values(kb.facts);
				return {
					ref: file.ref,
					path: file.path,
					id: kb.id,
					currency: kb.currency ?? null,
					goals: [...kb.goals],
					facts: facts.length,
					askable: facts.filter((f) => f.derived !== true).length,
					rules: kb.rules.length,
					clauses: Object.keys(kb.clauses).length,
					ok: true,
				};
			}
			const errors =
				outcome.kind === "too-big"
					? 1
					: outcome.diagnostics.filter((d) => d.severity === "error").length;
			return { ref: file.ref, path: file.path, ok: false, errors };
		});
		return ok({ kbs });
	});
}
