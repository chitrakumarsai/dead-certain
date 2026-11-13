/** Largest KB_File the Validator accepts: 1 MiB (Requirement 17, criterion 7). */
export const MAX_FILE_BYTES = 1048576;

/** Longest quoted source text in a message, in characters (Requirement 18, criterion 5). */
export const MAX_QUOTE = 200;

/** Deepest nesting the Loader walks before it reports SCHEMA_INVALID. */
export const MAX_DEPTH = 64;
