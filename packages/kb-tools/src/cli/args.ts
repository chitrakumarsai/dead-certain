/** Usage text printed by `dc help` (standard output) and on a usage error (standard error). */
export const USAGE = [
	"Usage:",
	"  dc validate [path...]   check knowledge bases",
	"  dc build [path...]      check knowledge bases and write apps/<app>/kb/dist/<stem>.json",
	"  dc golden [path...]     run golden scenarios against the compiled knowledge bases",
	"  dc help | --help | -h   print this text",
	"",
	"A path is a file apps/<app>/kb/<name>.yaml (golden: apps/<app>/golden/<name>.yaml)",
	"or a directory apps/<app>, relative to the repository root. With no path,",
	"every apps/*/kb/*.yaml (golden: every apps/*/golden/*.yaml) is used.",
	"Exit status: 0 no errors, 1 errors, 2 usage problem.",
	"",
].join("\n");

export type Command = "validate" | "build" | "golden";

export type ParsedArgs =
	| { readonly kind: "help" }
	| {
			readonly kind: "run";
			readonly command: Command;
			readonly paths: readonly string[];
	  }
	| { readonly kind: "usage"; readonly message: string };

/**
 * Parse the arguments that follow the program name (`process.argv.slice(2)`).
 * Anything that is not `validate|build [path...]` or a help request is a usage error.
 */
export function parseArgs(argv: readonly string[]): ParsedArgs {
	const [command, ...rest] = argv;
	if (command === undefined) {
		return { kind: "usage", message: "dc: no command given." };
	}
	if (command === "help" || command === "--help" || command === "-h") {
		return rest.length === 0
			? { kind: "help" }
			: { kind: "usage", message: `dc: '${command}' takes no arguments.` };
	}
	if (command !== "validate" && command !== "build" && command !== "golden") {
		return { kind: "usage", message: `dc: unknown command '${command}'.` };
	}
	for (const arg of rest) {
		if (arg === "" || arg.startsWith("-")) {
			return {
				kind: "usage",
				message: `dc: malformed argument '${arg}'.`,
			};
		}
	}
	return { kind: "run", command, paths: rest };
}
