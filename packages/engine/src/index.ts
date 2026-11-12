// Public API for @dead-certain/engine

// Evaluator
export type {
	Env,
	EvalError,
	EvalErrorCode,
	EvalResult,
} from "./lang/evaluate";
export { evaluate } from "./lang/evaluate";
// Parser
export type { ParseError, ParseErrorCode, ParseResult } from "./lang/parse";
export { parse } from "./lang/parse";
// Printer
export { print } from "./lang/print";
// Core types
// Rule-language AST types
export type {
	Alternative,
	BinaryOp,
	BuiltinFn,
	Clause,
	EngineApi,
	Expr,
	FactDef,
	FactSource,
	FactType,
	FactValue,
	KnowledgeBase,
	LineItem,
	ProofNode,
	Question,
	Rule,
	Session,
	Unknown,
	Verdict,
} from "./types";
export { UNKNOWN } from "./types";
