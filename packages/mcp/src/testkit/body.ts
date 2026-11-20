// Test-only. A loose view of a Payload, for assertions.
import type { FactValue } from "@dead-certain/engine";
import type { ToolResult } from "../payload";

export interface ProofBody {
	fact: string;
	value: FactValue | null;
	source: string;
	rule?: string;
	clause?: string;
	because?: string;
	children: ProofBody[];
}

export interface Body {
	status: string;
	question: {
		fact: string;
		text: string;
		type: string;
		why?: string;
		clause?: string;
		options?: string[];
	};
	goals: Record<string, FactValue | null>;
	line_items: unknown[];
	needed: { fact: string }[];
	answers: Record<string, FactValue>;
	token: string;
	fact: string;
	value: FactValue | null;
	proof: ProofBody;
	text: string;
	clauses: Record<string, { title: string; text: string }>;
	kbs: Record<string, unknown>[];
	results: {
		ref: string;
		path: string;
		ok: boolean;
		errors: number;
		warnings: number;
		diagnostics: Record<string, unknown>[];
	}[];
	error: { code: string; message: string; diagnostics?: unknown[] };
}

export const bodyOf = (r: ToolResult): Body =>
	r.structuredContent as unknown as Body;
