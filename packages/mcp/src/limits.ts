/** Limits of requirements 6.3 and 6.4. */

/** Most keys in `answers`. */
export const MAX_ANSWER_KEYS = 200;
/** Longest fact name, in characters. */
export const MAX_FACT_NAME = 100;
/** Longest string value in `answers`, in characters. */
export const MAX_STRING_VALUE = 500;
/** Longest Replay_Token, in characters. */
export const MAX_TOKEN = 20_000;
/** Largest KB_File: 1 MiB, the kb-tools limit. */
export const MAX_KB_BYTES = 1_048_576;
/** Longest Payload text, in characters. */
export const MAX_PAYLOAD = 200_000;
/** Longest Tool_Error message, in characters. */
export const MAX_MESSAGE = 500;
/** Most diagnostics carried in a KB_INVALID error. */
export const MAX_ERROR_DIAGNOSTICS = 20;
