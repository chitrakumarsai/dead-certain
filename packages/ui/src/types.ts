/** What the kit needs to print values. The app takes it from `kb.currency`. */
export interface FormatContext {
	/** ISO 4217 code, for money. */
	readonly currency?: string;
	/** Defaults to "en-IN" for INR and "en" otherwise. */
	readonly locale?: string;
}
