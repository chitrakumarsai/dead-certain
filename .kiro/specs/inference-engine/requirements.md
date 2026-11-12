# Requirements Document

## Introduction

The inference-engine component is the decision core of Dead Certain. It implements the public API declared in `packages/engine/src/types.ts` (the `EngineApi` interface) so that `packages/engine/src/index.ts` exports eight functions: `start`, `next`, `answer`, `audit`, `explain`, `whatIf`, `encode` and `decode`.

The component covers five capabilities:

- **Consultation mode**: asks one question at a time, only for facts that can still change a goal, and stops as soon as every goal is decided (three-valued logic with early stop).
- **Audit mode**: takes a set of already-known facts and returns a verdict plus the questions still needed.
- **Proof trees**: shows, for any fact, the rules, facts and clauses behind its value.
- **What-if**: lists one-answer changes that alter the verdict, including threshold probing for number, money and date answers.
- **Replay codec**: turns a session into a URL-safe token and back, so a verdict link always reproduces the same verdict.

The component builds on the existing rule language in `packages/engine/src/lang` (`parse`, `print`, `evaluate`, and the internal `UNKNOWN` symbol). Parsing of rule text belongs to the rule-language spec, which is already built. Loading knowledge-base files belongs to the kb-tools spec. Both are out of scope here.

Two boundary rules shape every requirement:

- The internal `UNKNOWN` symbol exists only inside the engine. At the public boundary, an unknown value is `undefined`, and every public value is plain JSON.
- The engine has zero runtime dependencies and is pure: no clock, no randomness, no input or output.

### Approved contract change (both lanes have consented)

`LineItem.label` is a required string in `types.ts`, but the knowledge-base format in `docs/kb-format.md` had no field that supplies it. The human has approved the following single contract change for both lanes:

- Add an optional `readonly label?: string` to `FactDef` in `packages/engine/src/types.ts`.
- Add an optional `label` string property to the fact properties table in `docs/kb-format.md`.
- Record a note for the kb-tools spec to add the optional `label` to its schema (see "Notes for the kb-tools spec").

The Engine uses `FactDef.label` when it is present and falls back to the Derived_Label otherwise, so existing knowledge bases keep working unchanged. The Derived_Label turns underscores into spaces and capitalises the first letter, so `room_rent_excess` becomes `Room rent excess`. The Derived_Label is deterministic and needs no clause title, because several facts can cite one clause and a clause title describes the rulebook section, not the line the user sees.

This is the only change to `types.ts` that this spec allows. Any other change needs a written proposal and both lanes' consent (Requirement 23, criteria 8 and 9). Requirement 7 specifies the label behaviour. Requirement 23 specifies the tasks that apply the change.

---

## Glossary

- **Engine**: The inference engine in `packages/engine`, exposed through the functions exported from `index.ts`.
- **Knowledge_Base**: A compiled `KnowledgeBase` value as declared in `types.ts`.
- **Session**: A `Session` value holding a Knowledge_Base and the answers given so far.
- **Fact**: A named, typed value declared in `Knowledge_Base.facts`.
- **Askable_Fact**: A non-derived Fact that has an `ask` text.
- **Derived_Fact**: A Fact whose `derived` property is true. Rules set its value.
- **Goal**: A fact named in `Knowledge_Base.goals`. A Verdict reports one value per Goal.
- **Unknown**: The state of a Fact with no value yet. Internally the engine represents it with the `UNKNOWN` symbol. At the public boundary it is `undefined`.
- **Decided**: A Goal is Decided when its value is a `FactValue`, or when the Engine has shown that no rule can apply to it (see Requirement 4).
- **Resolved_Value**: The value of a Fact computed from the Session answers by the rule-resolution procedure in Requirement 4.
- **Rule_Resolution**: The procedure that computes a Derived_Fact's Resolved_Value by trying its rules in file order.
- **Relevant_Fact**: An unanswered Askable_Fact that a not-yet-Decided Goal depends on, through rules and guards that the current answers have not already settled.
- **Consultation_Mode**: Use of `start`, `next` and `answer` to ask one question at a time.
- **Audit_Mode**: Use of `audit` to evaluate a knowledge base against a set of known facts.
- **Proof_Tree**: A `ProofNode` tree returned by `explain`.
- **Replay_Token**: The URL-safe string returned by `encode`.
- **Codec**: The pair of functions `encode` and `decode`.
- **Engine_Error**: A typed error thrown by the Engine for invalid input. It carries a `code` and a `message`.
- **Public_Value**: Any value returned by an Engine function: `Session`, `Question`, `Verdict`, `LineItem`, `ProofNode`, `Alternative`, or a Replay_Token.
- **Plain_JSON**: A value built only from objects, arrays, strings, finite numbers and booleans, with `undefined` allowed only as the value of an optional or unknown property. It survives `JSON.stringify` followed by `JSON.parse` without loss, except that properties holding `undefined` are dropped.
- **Deep_Equal**: Structural equality of two values, treating a property that holds `undefined` and an absent property as equal.
- **Derived_Label**: The label computed from a fact name: underscores replaced by single spaces, first character upper-cased, the rest unchanged.
- **Approved_Label**: The optional `label` string on a `FactDef`, approved as the single contract change to `types.ts`. When present, it is the display name of the Fact.
- **Known_Value**: The Resolved_Value of an expression in the current Session when that value is a `FactValue` and not Unknown. An expression may be a literal, a Fact reference (derived or answered) or a computed expression.
- **Threshold_Candidate**: A candidate value for a `number`, `money` or `date` Fact that `whatIf` derives from a comparison in the rules (Requirement 10, criteria 10 to 17).
- **Minor_Unit**: The smallest step of a type for threshold probing: 1 for `number`, 1 for `money` (one paisa, because `money` is whole paise stored as a safe integer) and one calendar day for `date`.
- **Skipped_Branch**: A part of a `when` guard or `to` expression that the deciding evaluation does not evaluate, such as the right operand of `and` or `or` after short-circuiting, or the untaken branch of an `if`. A Fact is "referenced only in a Skipped_Branch" when every reference to it in the evaluated rule expressions lies in a Skipped_Branch.
- **Consultation_Step**: One call to `answer` followed by one call to `next` on the result.
- **Benchmark_KB**: The knowledge-base fixture used by the performance test (Requirement 22).
- **Rule_Language**: The existing `parse`, `print` and `evaluate` functions in `packages/engine/src/lang`.
- **Dead_Certain**: The product this component belongs to.

---

## Requirements

### Requirement 1: Public API surface

**User Story:** As an app or tool developer, I want the engine to export exactly the functions in the `EngineApi` contract, so that both lanes can build against one frozen API.

#### Acceptance Criteria

1. THE Engine SHALL export from `packages/engine/src/index.ts` the named functions `start`, `next`, `answer`, `audit`, `explain`, `whatIf`, `encode` and `decode`, each with the signature declared in `EngineApi`.
2. WHEN `tsc --noEmit` runs over `packages/engine`, THE Engine SHALL compile with zero type errors on a type-level check that an object made of the eight exported functions is assignable to `EngineApi`.
3. THE Engine SHALL keep every export that `index.ts` had before this spec (the Rule_Language functions `parse`, `print` and `evaluate`, the types re-exported from `types.ts`, and `UNKNOWN`) with the same name and an unchanged signature.
4. THE Engine SHALL export the `Engine_Error` class and its error-code type from `index.ts` without any edit to `types.ts`.
5. THE Engine SHALL declare zero entries under `dependencies` in `packages/engine/package.json`.
6. THE Engine SHALL return Deep_Equal results from two calls of the same function with Deep_Equal arguments, and SHALL read no clock, random source, file system, network or module-level mutable state while computing them.
7. THE Engine SHALL contain no import of a Node-only module (any `node:` specifier or built-in such as `fs`, `path` or `crypto`) and no use of a Node-only global (such as `process` or `Buffer`) in `packages/engine/src` files other than test files.
8. WHEN the Engine builds for a browser target, THE Engine SHALL complete the build with zero errors and zero unresolved Node built-in imports.
9. WHEN any Engine function returns or throws, THE Engine SHALL leave each argument Deep_Equal to a copy taken before the call, including nested objects and arrays inside the Knowledge_Base, the Session and the answers.
10. IF a caller passes an argument that is frozen with `Object.freeze` (deeply), THEN THE Engine SHALL complete the call without throwing a `TypeError`.

### Requirement 2: Starting a session

**User Story:** As an app developer, I want `start` to give me an empty session for a knowledge base, so that I can begin a consultation.

#### Acceptance Criteria

1. WHEN `start` is called with a valid Knowledge_Base, THE Engine SHALL return a Session whose `kb` is that Knowledge_Base and whose `answers` is an empty object with zero properties.
2. IF a Goal names a Fact that is absent from `Knowledge_Base.facts`, THEN THE Engine SHALL throw an Engine_Error with code `INVALID_KB` whose `message` contains the name of that Goal, and SHALL return no Session.
3. IF a rule's `set` names a Fact that is absent from `Knowledge_Base.facts`, THEN THE Engine SHALL throw an Engine_Error with code `INVALID_KB` whose `message` contains the id of that rule, and SHALL return no Session.
4. IF the rules contain a dependency cycle, meaning a Derived_Fact that depends on itself, directly or through other Derived_Facts, via rule guards or rule `to` expressions, THEN THE Engine SHALL throw an Engine_Error with code `CYCLE` whose `message` contains the name of every Fact on the cycle, and SHALL return no Session.
5. IF a Knowledge_Base breaks more than one condition in criteria 2 to 4, THEN THE Engine SHALL throw a single Engine_Error for the first condition found, checking the conditions in this order: criterion 2, criterion 3, criterion 4.
6. WHEN `next`, `audit`, `explain`, `whatIf` or `encode` receives a Knowledge_Base that breaks a condition in criteria 2 to 4, THE Engine SHALL throw the same Engine_Error, with the same `code` and `message`, that `start` throws for that Knowledge_Base.
7. WHEN `start` is called, THE Engine SHALL leave the Knowledge_Base argument unmodified, and the returned Session's `kb` SHALL be the same Knowledge_Base value that was passed in.
8. WHEN `start` is called twice with the same Knowledge_Base, THE Engine SHALL return two Sessions that are Deep_Equal and SHALL NOT share the same `answers` object, so that answering one Session cannot change the other.

### Requirement 3: Recording answers

**User Story:** As an app developer, I want `answer` to return a new session with one more answer, so that I can move a consultation forward without mutating earlier state.

#### Acceptance Criteria

1. WHEN `answer` is called with a Session, a Fact name and a valid value, THE Engine SHALL return a new Session with the same `kb` and with `answers` holding all previous answers plus the given pair.
2. WHEN `answer` is called for a Fact that already has an answer and the value is valid, THE Engine SHALL replace the earlier answer with the new value in the returned Session and keep the other answers unchanged.
3. WHEN `answer` returns, THE Engine SHALL leave the Session passed to `answer` Deep_Equal to its state before the call, and the returned Session SHALL share no mutable object or array with it.
4. IF a Fact name that an Engine function looks up is absent from `Knowledge_Base.facts`, whether it is the name argument of `answer` or `explain`, a key of an answers record, a key of a facts record or a Fact name in a decoded Replay_Token, THEN THE Engine SHALL throw an Engine_Error with code `UNKNOWN_FACT` whose message names the Fact, and SHALL return no result. This applies to every Engine function in every calling context. Goal names and rule `set` names are governed by Requirement 2, criteria 2 and 3.
5. IF the named Fact is a Derived_Fact, THEN THE Engine SHALL throw an Engine_Error with code `NOT_ANSWERABLE` whose message names the Fact, and SHALL return no Session.
6. IF any Engine function that receives an answer (`answer`, `next`, `audit`, `explain`, `whatIf`, `encode` or `decode`) receives a value that does not match the Fact's type, THEN THE Engine SHALL throw an Engine_Error with code `INVALID_ANSWER` whose message names the Fact, and SHALL return no result. This holds whichever of those functions is called.
7. THE Engine SHALL accept as a valid value only these combinations:
   - a boolean for `boolean`;
   - a finite number for `number`, so `NaN`, `Infinity` and `-Infinity` are invalid;
   - a safe integer for `money`, meaning an integer from -9,007,199,254,740,991 to 9,007,199,254,740,991 inclusive;
   - a `YYYY-MM-DD` string that the Rule_Language date validator accepts as a real calendar date for `date`, so `2025-02-30` is invalid;
   - one of the Fact's `options`, compared by exact, case-sensitive string equality, for `enum`.
8. IF the value is `undefined`, `null`, a symbol or the internal `UNKNOWN` symbol, THEN THE Engine SHALL throw an Engine_Error with code `INVALID_ANSWER`, whatever the Fact's type.
9. IF the Session's Knowledge_Base breaks a condition in Requirement 2, criteria 2 to 4, THEN THE Engine SHALL throw the same Engine_Error as `start` and SHALL NOT evaluate the Fact name or the value.
10. WHEN `next`, `audit`, `explain`, `whatIf` or `encode` receives answers that break criteria 4 to 8, THE Engine SHALL throw the same Engine_Error as `answer` would throw for the first offending answer, taking answers in the order of Fact names sorted by code-point order.

### Requirement 4: Rule resolution with three-valued logic

**User Story:** As a knowledge-base author, I want rules for the same fact tried in file order with unknown handled by Kleene logic, so that the engine decides as early as the rules allow.

#### Acceptance Criteria

1. WHEN the Engine resolves a non-derived Fact that has an answer in the Session, THE Engine SHALL give the Fact the answered value as its Resolved_Value.
2. WHEN the Engine resolves a non-derived Fact that has no answer in the Session, THE Engine SHALL give the Fact the Unknown value.
3. WHEN the Engine resolves a Derived_Fact, THE Engine SHALL try the rules whose `set` names that Fact one at a time, in the order they appear in `Knowledge_Base.rules`, starting with the first, and SHALL stop at the first rule that is deciding (criterion 4), Unknown (criterion 6) or exhausted (criterion 7).
4. WHEN a rule has no `when` guard, or its `when` guard evaluates to `true`, THE Engine SHALL give the Derived_Fact the value of that rule's `to` expression, record that rule as the deciding rule, and try no later rule for the Fact.
5. WHEN a rule's `when` guard evaluates to `false`, THE Engine SHALL skip that rule and try the next rule for the same Fact.
6. WHILE the `when` guard of the next untried rule evaluates to Unknown, THE Engine SHALL give the Derived_Fact the Unknown value, record no deciding rule, and try no later rule for the Fact.
7. WHEN every rule for a Derived_Fact has a `when` guard that evaluates to `false`, or the Derived_Fact has no rules, THE Engine SHALL mark the Fact as inapplicable, with Resolved_Value `undefined` and no deciding rule.
8. WHEN the deciding rule's `to` expression evaluates to Unknown, THE Engine SHALL give the Derived_Fact the Unknown value while still recording that rule as the deciding rule.
9. THE Engine SHALL evaluate every `when` guard and every `to` expression with the Rule_Language `evaluate` function, passing the Resolved_Value of each referenced Fact, with Unknown passed as `UNKNOWN`.
10. WHEN a `when` guard or `to` expression combines Unknown with known operands, THE Engine SHALL apply Kleene three-valued logic as implemented by the Rule_Language, so that `false and Unknown` is `false`, `true or Unknown` is `true`, and `true and Unknown` and `false or Unknown` are Unknown.
11. IF the Rule_Language returns an evaluation error for a rule, THEN THE Engine SHALL throw an Engine_Error with code `EVALUATION_ERROR` whose `message` carries the rule id and the Rule_Language error code, and SHALL return no partial result.
12. THE Engine SHALL evaluate each Fact at most once per Engine call, so that the Rule_Language `evaluate` function is invoked at most once per rule guard and at most once per `to` expression in that call.
13. THE Engine SHALL give the same Resolved_Value for a Fact whatever the order of the keys in the Session `answers` object.
14. IF the deciding rule's `to` expression for a Derived_Fact of type `money` evaluates to a Known_Value that is a finite number and not an integer, THEN THE Engine SHALL throw an Engine_Error with code `NON_INTEGER_MONEY` whose `message` contains the rule id and the Fact name, and SHALL return no partial result. Rule authors write `round(...)` explicitly to avoid this error.
15. WHEN the deciding rule's `to` expression for a Derived_Fact of type `money` evaluates to Unknown, THE Engine SHALL NOT throw `NON_INTEGER_MONEY`, because the check of criterion 14 applies to the deciding rule's `to` value only once it is a Known_Value.
16. THE Engine SHALL apply the check of criterion 14 to the deciding rule's `to` value only, so that a rule that is skipped, not reached, or Unknown cannot cause `NON_INTEGER_MONEY`.
17. THE Engine SHALL cover criteria 14 to 16 with a unit test file named `money.test.ts` that asserts an `NON_INTEGER_MONEY` Engine_Error naming the rule id for a rule of the form `sum_insured * 0.01` that yields a fraction, asserts success for the same rule written with `round(...)`, and asserts that an Unknown `to` value and an unmatched guard throw no error.

### Requirement 5: Consultation with early stop

**User Story:** As a policyholder, I want to be asked only the questions that matter and to see my result as soon as it is settled, so that the consultation is short.

#### Acceptance Criteria

1. WHEN `next` is called on a Session and every Goal is Decided, THE Engine SHALL return a Verdict whose `needed` is an empty array and whose `goals` holds the Resolved_Value of each Goal.
2. WHEN `next` is called on a Session, at least one Goal is not Decided, and at least one Relevant_Fact exists, THE Engine SHALL return exactly one Question, and that Question SHALL be for the first Relevant_Fact found by the walk in criterion 3.
3. WHEN the Engine selects a Relevant_Fact, THE Engine SHALL walk the Goals that are not Decided in `goals` order. For each Fact reached, it SHALL try the rules of that Fact in file order. For each rule, it SHALL visit the guard operands from left to right, then the `to` expression operands from left to right. The Engine SHALL stop at the first Relevant_Fact reached.
4. WHEN short-circuit evaluation has settled every expression that references a Fact (as in `false and x` and `true or x`), THE Engine SHALL treat that Fact as not relevant for those expressions.
5. IF a Fact has an answer in the Session, THEN THE Engine SHALL NOT return a Question for it.
6. WHEN `next` is called, at least one Goal is not Decided, and no Relevant_Fact exists, THE Engine SHALL return a Verdict whose `needed` is an empty array and whose undecided Goals hold `undefined`.
7. WHEN `next` is called on a Session with an empty `answers` object, THE Engine SHALL return a result Deep_Equal to the result of `next` on the Session that `start` returns for the same Knowledge_Base.
8. WHEN `next` is called on a Session whose answers break Requirement 3, criteria 4 to 7, THE Engine SHALL throw the Engine_Error with the matching code from Requirement 3 and SHALL return no Question or Verdict.
9. WHEN `next` is called twice on the same Session, THE Engine SHALL return Deep_Equal results and SHALL leave the Session unchanged.

### Requirement 6: Question content

**User Story:** As an interface developer, I want each question to carry its text, its reason and its clause, so that the interface can explain why it asks.

#### Acceptance Criteria

1. WHEN `next` returns a Question, THE Engine SHALL set `Question.kind` to `"question"` and `Question.fact` to the name of the Relevant_Fact.
2. WHEN `next` returns a Question, THE Engine SHALL set `Question.text` to the `ask` text of the Relevant_Fact, unchanged and as a non-empty string.
3. WHERE the Relevant_Fact has a `why` text, THE Engine SHALL set `Question.why` to that text, unchanged.
4. WHEN `next` returns a Question and the walk in Requirement 5, criterion 3 reaches at least one rule that references the Relevant_Fact, THE Engine SHALL set `Question.clause` to the `cite` of the first such rule reached by the walk, and that `cite` SHALL be the id of a clause that exists in `Knowledge_Base.clauses`.
5. IF the Relevant_Fact has no `why` text, THEN THE Engine SHALL omit the `why` property from the Question, so that `"why" in question` is `false`.
6. IF `next` returns a Question and the walk in Requirement 5, criterion 3 reaches no rule that references the Relevant_Fact, THEN THE Engine SHALL omit the `clause` property from the Question, so that `"clause" in question` is `false`.
7. THE Engine SHALL give every Question in `Verdict.needed` the same `kind`, `fact`, `text`, `why` and `clause` values that criteria 1 to 6 define, so that a Question from `audit` is Deep_Equal to the Question `next` returns for the same Relevant_Fact and the same answers.
8. THE Engine SHALL return each Question as Plain_JSON that has no property other than `kind`, `fact`, `text`, `why` and `clause`.

### Requirement 7: Verdict and line items

**User Story:** As a policyholder, I want a verdict that lists every goal value and every deduction or check with its rule and clause, so that I can see how the result was built.

#### Acceptance Criteria

1. THE Engine SHALL set `Verdict.kind` to `"verdict"` and give `Verdict.goals` exactly one property per Goal, in `goals` order, holding the Goal's Resolved_Value, or `undefined` when the Goal is Unknown or inapplicable.
2. THE Engine SHALL give `Verdict.lineItems` exactly one `LineItem` per Fact whose `role` is `deduction` or `check`, in the order the Facts appear in `Knowledge_Base.facts`, and no `LineItem` for any other Fact.
3. IF no Fact in the Knowledge_Base has `role` `deduction` or `check`, THEN THE Engine SHALL set `Verdict.lineItems` to the empty array.
4. THE Engine SHALL set `LineItem.fact` to the Fact's name, `LineItem.role` to the Fact's `role`, and `LineItem.value` to the Fact's Resolved_Value, or `undefined` when the Fact is Unknown or inapplicable.
5. WHEN the Fact has an Approved_Label (`FactDef.label` is present), THE Engine SHALL set `LineItem.label` to that `FactDef.label`, unchanged.

6. IF the Fact has no Approved_Label, THEN THE Engine SHALL set `LineItem.label` to the Derived_Label of the Fact name (for example, `room_rent_excess` gives `Room rent excess`).
7. THE Engine SHALL give `LineItem.label` the same value for equal Facts across calls.
8. WHEN a line item's Fact has a deciding rule, THE Engine SHALL set `LineItem.rule` to that rule's `id` and `LineItem.clause` to that rule's `cite`.
9. WHILE a line item's Fact has no deciding rule and at least one rule for the Fact is not yet ruled out (its guard is not `false`), THE Engine SHALL set `LineItem.rule` and `LineItem.clause` from the first such rule in file order.
10. IF a line item's Fact has rules but every rule has a guard that evaluates to `false` (the Fact is inapplicable), THEN THE Engine SHALL set `LineItem.value` to `undefined` and set `LineItem.rule` and `LineItem.clause` to the empty string.
11. IF a line item's Fact has no rule at all, THEN THE Engine SHALL set `LineItem.rule` and `LineItem.clause` to the empty string.
12. WHEN every Goal is Decided, THE Engine SHALL set `Verdict.needed` to the empty array.
13. WHILE at least one Goal is not Decided, THE Engine SHALL set `Verdict.needed` as specified in Requirement 5, criterion 6 for `next` and in Requirement 8, criterion 4 for `audit`.

### Requirement 8: Audit mode

**User Story:** As a developer submitting a repository, I want `audit` to evaluate a checklist from the facts already collected and tell me only what is still missing, so that I answer as little as possible.

#### Acceptance Criteria

1. WHEN `audit` is called with a Knowledge_Base and a facts record whose entries all pass the validation in criterion 2, THE Engine SHALL return a Verdict equal to the Verdict that `next` returns for a Session whose `kb` is that Knowledge_Base and whose `answers` equal the facts record, when `next` returns a Verdict.
2. IF any entry of the facts record names a Fact absent from `Knowledge_Base.facts`, names a Derived_Fact, or holds a value that does not match the Fact's type under Requirement 3 criterion 7, THEN THE Engine SHALL throw an Engine_Error with the code that Requirement 3 criteria 4 to 7 assign to that condition (`UNKNOWN_FACT`, `NOT_ANSWERABLE` or `INVALID_ANSWER`), whose message names the first offending Fact in the facts record's key order, and SHALL return no Verdict.
3. IF `audit` is called with a Knowledge_Base that breaks a condition in Requirement 2 criteria 2 to 4, THEN THE Engine SHALL throw the same Engine_Error as `start`, and SHALL return no Verdict.
4. WHEN at least one Goal is not Decided and at least one Relevant_Fact exists, THE Engine SHALL set `Verdict.needed` to one Question for each Relevant_Fact, with no Fact appearing more than once, in the order in which the walk of Requirement 5 criterion 3 first reaches each Fact.
5. WHEN at least one Goal is not Decided and no Relevant_Fact exists, THE Engine SHALL set `Verdict.needed` to the empty array and set each undecided Goal to `undefined` in `Verdict.goals`.
6. WHEN every Goal is Decided, THE Engine SHALL set `Verdict.needed` to the empty array.
7. THE Engine SHALL build each Question in `Verdict.needed` by the rules of Requirement 6, and SHALL include no Question for a Fact that has an entry in the facts record.
8. WHEN `audit` is called with an empty facts record, THE Engine SHALL return a Verdict whose `goals` and `lineItems` are Deep_Equal to those of the Verdict for a Session created by `start` for the same Knowledge_Base, and whose `needed` has as its first element the Question that `next` returns for that Session, if that result is a Question.
9. WHEN `audit` is called with a facts record that has no entries for some Askable_Facts, THE Engine SHALL treat those Facts as Unknown and SHALL NOT treat the absence of an entry as the value `false`.
10. WHEN `audit` completes, THE Engine SHALL leave the facts record and the Knowledge_Base unmodified, as required by Requirement 1 criterion 9.

### Requirement 9: Proof trees

**User Story:** As a user, I want to open any verdict line and see the rules, facts and clauses behind it, so that I can check the result myself.

Rationale: the X-ray proof must never fail where the verdict succeeded. A rule such as `if(a > 0, b / a, 0)` with `a` equal to 0 never evaluates its untaken branch `b / a`, so `next` returns a Verdict. If `explain` resolved every Fact in that untaken branch, it could raise a division-by-zero `EVALUATION_ERROR` for a Fact the deciding evaluation never read, and the user would see a verdict with no proof. `explain` therefore throws only where `next` also throws.

#### Acceptance Criteria

1. WHEN `explain` is called with a Session and the name of a Fact that exists in `Knowledge_Base.facts`, THE Engine SHALL return a `ProofNode` whose `fact` is that name and whose `value` is the Fact's Resolved_Value, or `undefined` when the Fact is Unknown or inapplicable.
2. IF the named Fact is absent from `Knowledge_Base.facts`, THEN THE Engine SHALL throw an Engine_Error with code `UNKNOWN_FACT` whose `message` names the Fact, and SHALL leave the Session unchanged.
3. WHEN the named Fact is not derived, THE Engine SHALL set `source` to `"answered"` and `children` to the empty array, and SHALL omit `rule`, `clause` and `because`.
   - The Engine returns `"answered"` for every non-derived leaf and never returns `"collected"`. The Pre-Flight interface knows which Facts its collector supplied and relabels them itself, so no contract change is needed.
4. WHEN the named Fact is a Derived_Fact, THE Engine SHALL set `source` to `"derived"`.
5. WHEN a Derived_Fact has a deciding rule, THE Engine SHALL set `rule` to that rule's `id` and `clause` to that rule's `cite`.
6. WHEN a Derived_Fact has a deciding rule, THE Engine SHALL set `because` to that rule's `because` sentence, with each `{name}` placeholder that names a Fact in the Knowledge_Base replaced by `String(value)` of that Fact's Resolved_Value, or by the text `unknown` when that value is Unknown or inapplicable.
7. IF a `{name}` placeholder in a `because` sentence does not name a Fact in the Knowledge_Base, THEN THE Engine SHALL leave that placeholder text unchanged in `because`.
8. WHEN a Derived_Fact has no deciding rule, THE Engine SHALL omit `rule`, `clause` and `because` from its node.
9. WHEN a Derived_Fact is built, THE Engine SHALL set `children` to one Proof_Tree per distinct Fact referenced by the guards of the rules tried for it and by the `to` expression of the deciding rule, ordered by first reference, including a Fact referenced only in a Skipped_Branch (see criterion 14). A rule is "tried" when the Rule_Resolution evaluated its guard, up to and including the deciding rule or the rule whose guard is Unknown.
10. WHEN a Derived_Fact has no deciding rule and no rule was tried, THE Engine SHALL set `children` to the empty array.
11. THE Engine SHALL give every `clause` in a Proof_Tree the id of a clause that exists in `Knowledge_Base.clauses`.
12. WHEN the same Fact is referenced by more than one node in a Proof_Tree, THE Engine SHALL give each occurrence a Deep_Equal subtree, and SHALL return a finite tree whose depth is at most the number of Facts in the Knowledge_Base.
13. THE Engine SHALL return a `ProofNode` that is Plain_JSON, with no `UNKNOWN` symbol in any node.
14. IF resolving a Fact that is referenced only in a Skipped_Branch raises an Engine_Error, THEN THE Engine SHALL still return the Proof_Tree from `explain`, and SHALL give the child node for that Fact the `value` `undefined`, an empty `children` array, and no `rule`, `clause` or `because` property. The child node keeps its `fact` name and its `source`.
15. THE Engine SHALL throw an Engine_Error from `explain` only for an input for which `next` also throws an Engine_Error of the same `code`: an invalid Knowledge_Base (`INVALID_KB` or `CYCLE`), an unknown Fact name (`UNKNOWN_FACT`), invalid answers (`NOT_ANSWERABLE` or `INVALID_ANSWER`), or an `EVALUATION_ERROR` or `NON_INTEGER_MONEY` on a path that `next` evaluates.
16. WHEN resolving a Fact that is referenced only in a Skipped_Branch raises no Engine_Error, THE Engine SHALL give the child node for that Fact the same full shape as any other node of its kind (its resolved `value`, its `source`, and for a Derived_Fact its `rule`, `clause`, `because` and `children`), and SHALL give the bare shape of criterion 14 only when that resolution raises an Engine_Error. A Fact read only in a Skipped_Branch never changes the `value` of its parent node.
17. THE Engine SHALL cover criteria 14 to 16 with a unit test file named `explain-skipped-branch.test.ts` that asserts, for a Derived_Fact whose deciding rule has the form `if(a > 0, b / a, 0)` with `a` answered 0, that `explain` returns a Proof_Tree and does not throw, that the child node for the Fact in the untaken branch has `value` `undefined`, no children and no `rule`, `clause` or `because`, that a child node for a Skipped_Branch Fact whose resolution raises no error is a full node with its resolved `value`, and that `explain` throws the same Engine_Error code as `next` for an `EVALUATION_ERROR` on an evaluated path, for `UNKNOWN_FACT` and for `INVALID_ANSWER`.

### Requirement 10: What-if

**User Story:** As a policyholder, I want to see which single changed answer would change my result, including a changed amount, number or date such as "Room rent at or below ₹5,000 a day: + ₹38,000", so that I can understand what drives it.

Rationale (human decision): the showcase line "Room rent at or below ₹5,000 a day: + ₹38,000" is a `money` answer. Without threshold probing, what-if would work only for yes/no and multiple-choice answers and would be nearly empty in Claim Check.

The comparison operators in the Rule_Language (`BinaryOp` in `packages/engine/src/types.ts`) are `<`, `<=`, `>`, `>=`, `==` and `!=`. The expression tree is a tagged union of `literal`, `fact`, `unary`, `binary` and `call` nodes. Threshold probing reads `binary` nodes with these six operators.

#### Acceptance Criteria

1. WHEN `whatIf` is called with a Session, THE Engine SHALL return an array of `Alternative` values, each describing one Askable_Fact that has an answer in the Session, one candidate value for that Fact that differs from the current answer, and the Verdict that results from changing only that answer.
2. THE Engine SHALL take the candidate values for a Fact from the Fact's type: `true` and `false` for `boolean`, each entry of the Fact's `options` for `enum`, and the Threshold_Candidates of criteria 10 to 17 for `number`, `money` and `date`.
3. THE Engine SHALL exclude from the candidates every value equal to the Fact's current answer, so that a `boolean` Fact yields at most 1 candidate, an `enum` Fact with N options yields at most N − 1 candidates, and a `number`, `money` or `date` Fact yields at most 6 candidates.
4. THE Engine SHALL compute each Alternative's Verdict by changing exactly one answer, leaving every other answer in the Session as it is, and leaving the Session passed to `whatIf` unchanged.
5. THE Engine SHALL include an Alternative only when the Verdict for the changed answer is not Deep_Equal to the Verdict for the current answers, for every Fact type.
6. THE Engine SHALL order the Alternatives by the position of the Fact in `Knowledge_Base.facts`, then by the position of the candidate value in the candidate list. The candidate list order is `false` before `true` for `boolean`, `options` order for `enum` (both unchanged from before threshold probing), and ascending numeric order for `number` and `money` or ascending chronological order for `date`.
7. IF computing the Verdict for a candidate value throws an Engine_Error (including `NON_INTEGER_MONEY` or `EVALUATION_ERROR`), THEN THE Engine SHALL omit that Alternative, SHALL continue with the remaining candidates, and SHALL NOT throw an Engine_Error from `whatIf` for that reason.
8. IF no single changed answer produces a Verdict that is not Deep_Equal to the current Verdict, THEN THE Engine SHALL return an empty array.
9. IF the Session has no answers, THEN THE Engine SHALL return an empty array.
10. WHEN the answered Fact has type `number`, `money` or `date`, THE Engine SHALL examine every `binary` node with operator `<`, `<=`, `>`, `>=`, `==` or `!=` in every `when` guard and every `to` expression of every rule in the Knowledge_Base, and SHALL treat the node as a probe when one operand is exactly a `fact` node naming the answered Fact.
11. WHEN a probe's other operand (any expression: a literal, a Fact reference, a Derived_Fact or a computed expression) has a Known_Value `v` in the current Session, THE Engine SHALL add `v` to the Fact's Threshold_Candidates.
12. WHEN a probe has a Known_Value `v`, THE Engine SHALL add to the Fact's Threshold_Candidates the nearest valid values on either side of `v`: `v - 1` and `v + 1` for `number`; `v - 1` and `v + 1` paise for `money`; and the previous and next calendar day for `date`, computed with calendar-day arithmetic over the same calendar validity that the Rule_Language date handling (`isValidDate`) uses.
13. IF the other operand of a probe is Unknown in the current Session, THEN THE Engine SHALL add no Threshold_Candidate from that probe.
14. IF the other operand of a probe references the answered Fact, THEN THE Engine SHALL add no Threshold_Candidate from that probe, because its value changes with the answer.
15. THE Engine SHALL remove from the Threshold_Candidates the current answer, every duplicate, and every invalid value, where invalid means: a non-finite `number`; a `money` value that is negative, not an integer, or outside the safe-integer range; and a `date` that is not a real calendar date or lies outside years 0001 to 9999. A `v` of a different type from the answered Fact is also invalid.
16. THE Engine SHALL sort the remaining Threshold_Candidates ascending (numeric order for `number` and `money`, chronological order for `date`) and SHALL keep the first 6, applying this cap to the candidate list before any Verdict is computed.
17. THE Engine SHALL give the same Threshold_Candidates for the same Session whatever the order of keys in `answers` or of the rules visited, because the cap and the sort apply to the de-duplicated set.
18. IF the Session's Knowledge_Base or answers break a condition in Requirement 2, criteria 2 to 4, or Requirement 3, criteria 4 to 7, THEN THE Engine SHALL throw the Engine_Error specified there, as for `next`, and SHALL return no array.
19. IF computing the Verdict for the current answers throws an Engine_Error, THEN THE Engine SHALL throw that Engine_Error from `whatIf`, as `next` would, and SHALL return no array.
20. THE Engine SHALL cover threshold probing with a unit test file named `what-if-thresholds.test.ts` that asserts, for a `money` Fact compared with a Known_Value of 500000 paise, the candidates 499999, 500000 and 500001 (after exclusion of the current answer) and the Alternatives whose Verdict changes, and asserts the exclusion of negative `money` and of out-of-range dates.

### Requirement 11: Replay codec

**User Story:** As a user, I want a link that always reproduces my verdict, so that I can share a result and open it later.

#### Acceptance Criteria

1. WHEN `encode` is called with a valid Session, THE Codec SHALL return a Replay_Token that is a non-empty string made only of the characters `A-Z`, `a-z`, `0-9`, `-` and `_`.
2. THE Codec SHALL build the Replay_Token from a format version number, a fingerprint of the Knowledge_Base, and the answers sorted by Fact name in ascending order of UTF-16 code units.
3. THE Codec SHALL compute the Knowledge_Base fingerprint from the canonical JSON of the Knowledge_Base, so that two Knowledge_Bases that differ in any rule, fact or clause give different fingerprints, and two Deep_Equal Knowledge_Bases give the same fingerprint.
4. WHEN `decode` is called with a Knowledge_Base and a Replay_Token that is well-formed, has a supported format version and matches the Knowledge_Base fingerprint, THE Codec SHALL return a Session whose `kb` is that Knowledge_Base and whose `answers` are Deep_Equal to the encoded answers.
5. IF the token is an empty string, contains a character outside `A-Z`, `a-z`, `0-9`, `-` and `_`, has a payload that cannot be decoded, or has a payload of the wrong shape, THEN THE Codec SHALL throw an Engine_Error with code `MALFORMED_TOKEN` that names the failed check, and SHALL return no Session.
6. IF the token is well-formed and its format version is not supported, THEN THE Codec SHALL throw an Engine_Error with code `UNSUPPORTED_VERSION` that names the version found in the token, and SHALL return no Session.
7. IF the token is well-formed and its fingerprint differs from the fingerprint of the given Knowledge_Base, THEN THE Codec SHALL throw an Engine_Error with code `KB_MISMATCH` whose `message` states that the rules have changed, and SHALL return no Session.
   - A Replay_Token is tied to the exact rules version. If the rules change, an old link gives this clear error instead of a different verdict.
8. IF a decoded answer breaks Requirement 3, criteria 4 to 7, THEN THE Codec SHALL throw the Engine_Error with the matching code from Requirement 3 that names the Fact at fault, and SHALL return no Session.
9. IF a token lists the same Fact name more than once, THEN THE Codec SHALL throw an Engine_Error with code `MALFORMED_TOKEN` that names the repeated Fact.
10. WHEN `decode` finds more than one fault in a token, THE Codec SHALL report the first fault in this order: `MALFORMED_TOKEN`, `UNSUPPORTED_VERSION`, `KB_MISMATCH`, then the answer errors of Requirement 3 in the order of the sorted Fact names.
11. THE Codec SHALL give equal Replay_Tokens for Sessions with Deep_Equal `answers` and Deep_Equal `kb`, whatever order the answers were added in.
12. WHEN `encode` is called with a Session of at most 64 answers, each Fact name at most 64 characters long and each string value at most 64 characters long, THE Codec SHALL return a Replay_Token of at most 2,048 characters.
13. WHEN `encode` is called with a Session that has no answers, THE Codec SHALL return a Replay_Token that `decode` turns back into a Session with an empty `answers` object.
14. IF `encode` is called with a Session whose answers break Requirement 3, criteria 4 to 7, THEN THE Codec SHALL throw the Engine_Error with the matching code from Requirement 3 and SHALL return no Replay_Token.
15. FOR ALL valid Sessions, `decode(kb, encode(session))` SHALL give a Session Deep_Equal to the original (round-trip property).
16. FOR ALL Replay_Tokens produced by `encode` for a Knowledge_Base, `encode(decode(kb, token))` SHALL give a string equal to the token (inverse round-trip property).

### Requirement 12: Public values contain no internal symbols and are plain JSON

**User Story:** As an interface developer, I want every value from the engine to be plain JSON with `undefined` meaning unknown, so that I can store, send and render it without knowing the engine's internals.

#### Acceptance Criteria

1. WHEN any Engine function returns a Public_Value, THE Engine SHALL have replaced every internal `UNKNOWN` symbol in it with `undefined`, so that a recursive walk of the returned value finds no `UNKNOWN` symbol in any `Verdict`, `LineItem`, `ProofNode`, `Question`, `Alternative`, `Session` or Replay_Token.
2. WHEN any Engine function returns a Public_Value, THE Engine SHALL return only plain objects, arrays, strings, finite numbers, booleans and `undefined`, with `undefined` appearing only as the value of an optional or unknown property, and no value of type `symbol`, `function` or `bigint`, and no object other than a plain object or array (a class instance, `Date`, `Map`, `Set` or `null` prototype-less exotic object counts as a violation).
3. IF a computed number is `NaN`, `Infinity` or `-Infinity`, THEN THE Engine SHALL throw an Engine_Error with code `EVALUATION_ERROR` that names the rule id or Fact at fault, and SHALL return no Public_Value for that call.
4. WHEN any Engine function returns a Public_Value `v`, THE Engine SHALL return a `v` for which `JSON.parse(JSON.stringify(v))` is Deep_Equal to `v`.
5. WHEN a Goal, a line item Fact or a proof node Fact is Unknown or inapplicable, THE Engine SHALL set `Verdict.goals[goal]`, `LineItem.value` or `ProofNode.value` respectively to `undefined`, and SHALL keep the property in the returned object's key order (the key is present with value `undefined`, not removed).
6. IF an `answer` call receives, as its value, `undefined`, `null`, a symbol, the `UNKNOWN` symbol, `NaN`, `Infinity` or `-Infinity`, THEN THE Engine SHALL throw an Engine_Error with code `INVALID_ANSWER` that names the Fact, and SHALL return no Session.
7. IF an `audit` call receives a facts record in which any entry's value is `undefined`, `null`, a symbol, the `UNKNOWN` symbol, `NaN`, `Infinity` or `-Infinity`, THEN THE Engine SHALL throw an Engine_Error with code `INVALID_ANSWER` that names the Fact, and SHALL return no Verdict.
8. IF `next`, `explain`, `whatIf` or `encode` receives a Session whose `answers` hold a value listed in criterion 6, THEN THE Engine SHALL throw an Engine_Error with code `INVALID_ANSWER` that names the Fact.

### Requirement 13: Typed errors

**User Story:** As an app developer, I want invalid input to raise one recognisable error type with a stable code, so that I can handle failures without parsing messages.

#### Acceptance Criteria

1. IF an Engine function receives invalid input, THEN THE Engine SHALL throw an instance of Engine_Error and SHALL throw no other kind of exception for that input.
2. THE Engine SHALL give every Engine_Error a `code` equal to exactly one of these ten strings: `INVALID_KB`, `CYCLE`, `UNKNOWN_FACT`, `NOT_ANSWERABLE`, `INVALID_ANSWER`, `EVALUATION_ERROR`, `NON_INTEGER_MONEY`, `MALFORMED_TOKEN`, `UNSUPPORTED_VERSION`, `KB_MISMATCH`.
3. THE Engine SHALL give every Engine_Error a non-empty `message` string of at most 500 characters that contains the name of the Fact, the rule id or the Goal at fault, as the code requires: the Goal name or rule id for `INVALID_KB`, the Fact names on the cycle for `CYCLE`, the Fact name for `UNKNOWN_FACT`, `NOT_ANSWERABLE` and `INVALID_ANSWER`, the rule id for `EVALUATION_ERROR`, the rule id and the Fact name for `NON_INTEGER_MONEY`, and, for `KB_MISMATCH`, the statement that the rules have changed.
4. IF an Engine_Error has code `EVALUATION_ERROR`, THEN THE Engine SHALL include in its `message` both the rule id and the Rule_Language error code.
5. WHEN an Engine function throws an Engine_Error, THE Engine SHALL leave its arguments unmodified and SHALL return no partial result.
6. WHEN an Engine_Error is passed through `JSON.stringify` and `JSON.parse`, THE Engine SHALL preserve `code` and `message` as strings Deep_Equal to the originals.
7. IF an Engine function receives input that breaks more than one validation condition, THEN THE Engine SHALL throw one Engine_Error for the first condition found, checking in this order: `INVALID_KB`, `CYCLE`, `UNKNOWN_FACT`, `NOT_ANSWERABLE`, `INVALID_ANSWER`, then the rule-evaluation errors `EVALUATION_ERROR` and `NON_INTEGER_MONEY`. Validation of the Knowledge_Base and answers therefore always runs before any rule is resolved, and among rule-evaluation errors the Engine SHALL throw the first one met in the Rule_Resolution order of Requirement 4.
8. FOR ALL arbitrary string inputs to `decode`, THE Codec SHALL either return a Session or throw an Engine_Error, and SHALL throw no other kind of exception.
9. THE Engine SHALL throw `EVALUATION_ERROR` or `NON_INTEGER_MONEY` from `explain` only for a rule on a path that `next` evaluates for the same Session, and SHALL NOT throw either code from `explain` for a Fact referenced only in a Skipped_Branch (Requirement 9, criteria 14 and 15). Criterion 7 therefore orders the errors of `explain` as it does for `next`.

### Requirement 14: Property — determinism

**User Story:** As a maintainer, I want the same inputs to give the same outputs every time, so that verdicts can be replayed and tested.

#### Acceptance Criteria

1. THE Engine SHALL return Deep_Equal results when `next`, `audit`, `explain`, `whatIf` or `encode` is called twice with Deep_Equal inputs, for all Knowledge_Bases and answer sets.
2. THE Engine SHALL return results whose `JSON.stringify` text is identical, including property order, when `next`, `audit`, `explain`, `whatIf` or `encode` is called twice with Deep_Equal inputs.
3. WHEN the answers object of a Session, or the facts record passed to `audit`, is rebuilt with the same entries inserted in a different order, THE Engine SHALL return results from `next`, `audit`, `explain`, `whatIf` and `encode` that are Deep_Equal to the results for the original order, and whose `JSON.stringify` text is identical to it.
4. WHEN `next`, `audit`, `explain`, `whatIf` or `encode` is called with a Session or facts record that is invalid under Requirement 3 (criteria 4 to 7), or with a Knowledge_Base that is invalid under Requirement 2 (criteria 2 to 4), THE Engine SHALL throw an Engine_Error with the same `code` and the same `message` on every call with Deep_Equal inputs.
5. WHEN `next`, `audit`, `explain`, `whatIf` or `encode` is called, THE Engine SHALL return a result that is unchanged by any earlier call to any Engine function, in the same process, with any other inputs.
6. THE Engine SHALL cover this property in a file named `determinism.props.test.ts` using fast-check, running each property at least 100 runs.
7. THE Engine SHALL return the same Proof_Tree, with the same Skipped_Branch child nodes (Requirement 9, criterion 14), on every call of `explain` with Deep_Equal inputs, so that the Skipped_Branch rule leaves determinism unchanged.

### Requirement 15: Property — order independence

**User Story:** As a maintainer, I want the order in which answers arrive to make no difference, so that the interface can let users answer in any order.

#### Acceptance Criteria

1. FOR ALL Knowledge_Bases and all permutations of a set of at most 12 valid answers, each for a different Fact, applying the answers with `answer` in each order to a Session created by `start` SHALL give Sessions with Deep_Equal `answers`.
2. FOR ALL such permutations, `next` on the resulting Sessions SHALL give Deep_Equal results, and the `JSON.stringify` text of those results SHALL be identical, including property order.
3. FOR ALL such permutations, `encode` on the resulting Sessions SHALL give identical Replay_Tokens.
4. FOR ALL such permutations, `audit` called with the facts record built by inserting the entries in each order SHALL give Deep_Equal Verdicts.
5. FOR ALL such permutations, `explain` on the resulting Sessions for each Goal SHALL give Deep_Equal Proof_Trees.
6. FOR ALL such permutations, `whatIf` on the resulting Sessions SHALL give Deep_Equal arrays of Alternatives in the same order, including the Threshold_Candidates for `number`, `money` and `date` Facts, which are deterministic and independent of answer order.
7. IF any permutation of valid answers causes an Engine function to throw an Engine_Error, THEN THE Engine SHALL throw an Engine_Error with the same `code` for every other permutation of that answer set.
8. THE Engine SHALL cover this property in a file named `order-independence.props.test.ts` using fast-check, with at least 100 runs and with generated answer sets that include the empty set, a single answer, and sets of 2 to 12 answers.

### Requirement 16: Property — sound proofs

**User Story:** As a user, I want every proof to be checkable, so that an X-ray never shows a step that does not hold.

#### Acceptance Criteria

1. FOR ALL Knowledge_Bases, Sessions and Fact names where the Fact is a Goal or the Fact of a line item, THE Engine SHALL return a root `ProofNode` from `explain` whose `value` is Deep_Equal to the value that the Verdict from `next` or `audit` reports for that Fact (`Verdict.goals` entry or `LineItem.value`), with `undefined` equal to `undefined`.
2. FOR ALL derived nodes that have a deciding rule, THE Engine SHALL return a node whose `value` is Deep_Equal to the result of the Rule_Language `evaluate` function on the rule's `to` expression, using an environment built from the `value` of each child node, with a child `value` of `undefined` read as Unknown.
3. FOR ALL derived nodes that have a deciding rule, THE Engine SHALL return a node for which the rule has no `when` guard, or for which the Rule_Language `evaluate` function on the rule's `when` guard, using the same environment as criterion 2, returns `true`.
4. FOR ALL derived nodes that have a deciding rule, THE Engine SHALL return a node for which every rule for the same Fact that appears before the deciding rule in `Knowledge_Base.rules` has a `when` guard that the Rule_Language `evaluate` function, using the same environment as criterion 2, evaluates to `false`.
5. FOR ALL leaf nodes, THE Engine SHALL return a node whose `value` is Deep_Equal to the Session's answer for the Fact, or is `undefined` when the Fact has no answer, and whose `children` is the empty array.
6. FOR ALL nodes that have a `clause`, THE Engine SHALL return a node whose `clause` is the id of a clause in `Knowledge_Base.clauses` and is equal to the `cite` of the rule named by the node's `rule`.
7. FOR ALL derived nodes that have a `because`, THE Engine SHALL return text that contains no `{name}` placeholder where `name` is a Fact of the Knowledge_Base.
8. FOR ALL derived nodes that have no deciding rule, THE Engine SHALL return a node with no `rule`, no `clause` and no `because` property, and whose `value` is `undefined`.
9. IF any of criteria 1 to 8 does not hold for a generated input, THEN THE Engine's property test SHALL fail and report the shrunk counterexample from fast-check, made of the Knowledge_Base, the answers and the Fact name.
10. THE Engine SHALL cover this property in a file named `sound-proofs.props.test.ts` using fast-check, with at least 100 runs, and with generated Knowledge_Bases that have no dependency cycle and Sessions in which each Askable_Fact is answered or left unanswered, so that both Unknown and known values reach the check.
11. FOR ALL child nodes for a Fact referenced only in a Skipped_Branch of the parent's evaluation, THE property test SHALL exempt the node from the check that its `value` equals the Fact's Resolved_Value (criterion 1 and the evaluation checks of criteria 2 to 4 read no such child), and SHALL still require that the node has `value` `undefined`, an empty `children` array, and no `rule`, `clause` or `because` property, whenever resolving that Fact raises an Engine_Error.
12. IF resolving a Fact referenced only in a Skipped_Branch raises no Engine_Error, THEN THE node for that Fact SHALL satisfy criteria 1 to 8 in full, so that the exemption of criterion 11 applies only where the resolution raises an Engine_Error.
13. THE property test SHALL include generated Knowledge_Bases with a Skipped_Branch whose Fact resolution raises `EVALUATION_ERROR`, such as an untaken division by zero, and SHALL assert that `explain` returns a Proof_Tree whenever `next` returns a Verdict.

### Requirement 17: Property — no wasted questions

**User Story:** As a policyholder, I want every question to be one that can still change my result, so that I am never asked something pointless.

#### Acceptance Criteria

1. FOR ALL Knowledge_Bases and Sessions where `next` returns a Question, THE Engine SHALL return a Question whose Fact has no entry in the Session `answers`.
2. FOR ALL Knowledge_Bases and Sessions where `next` returns a Question, there SHALL exist two distinct valid values of the Question's Fact and one assignment of valid values to the other unanswered Askable_Facts, such that the two resulting Verdicts hold different values for at least one Goal. The check SHALL treat the Goal values from `Verdict.goals`, with `undefined` counted as a value.
3. FOR ALL Knowledge_Bases and Sessions where `next` returns a Verdict with `needed` empty and all Goals Decided, no unanswered Askable_Fact SHALL change any Goal value under any assignment of valid values to the unanswered Askable_Facts.
4. FOR ALL consultations driven to the end by answering each returned Question with a valid value, THE Engine SHALL return no Question for a Fact that was answered earlier in the same consultation.
5. FOR ALL Knowledge_Bases and Sessions where `next` returns a Verdict with `needed` empty and at least one Goal not Decided, no unanswered Askable_Fact SHALL be a Relevant_Fact, and no unanswered Askable_Fact SHALL change the Goal's value under any assignment of valid values to the unanswered Askable_Facts.
6. THE Engine SHALL cover this property in a file named `no-wasted-questions.props.test.ts` using fast-check, with generated Knowledge_Bases that have `boolean` and `enum` Facts only (so the test can enumerate every assignment), at most 8 Askable_Facts and at most 3 options per `enum` Fact (so a test enumerates at most 3^8 = 6,561 assignments), and contain no self-cancelling expressions. A self-cancelling expression is an expression whose value is the same under every assignment of one of its operand Facts (for example `x or not x`).
7. THE Engine SHALL run the property of criterion 6 with at least 100 runs, as required by Requirement 23, criterion 3.
8. IF a generated Knowledge_Base would break the limits in criterion 6, THEN THE test generator SHALL discard that Knowledge_Base and SHALL NOT count it toward the 100 runs.

### Requirement 18: Property — termination

**User Story:** As a maintainer, I want every consultation to finish after a bounded number of questions, so that no input can make the interface loop.

#### Acceptance Criteria

1. FOR ALL Knowledge_Bases without a dependency cycle and all Sessions valid for them, `start`, `next`, `answer`, `audit`, `explain`, `whatIf`, `encode` and `decode` SHALL each either return a result or throw an Engine_Error, and SHALL make no more than one Rule_Resolution pass per Fact per call (Requirement 4, criterion 12). A call that has not returned or thrown within 5,000 ms in the test SHALL count as a failure.
2. FOR ALL Knowledge_Bases without a dependency cycle and all answer policies that answer each Question returned by `next` with a valid value, the sequence of alternating `next` and `answer` calls SHALL end with `next` returning a Verdict after at most N `answer` calls, where N is the number of Askable_Facts in the Knowledge_Base.
3. FOR ALL such sequences, each `answer` call that follows a Question SHALL reduce the number of unanswered Askable_Facts by exactly 1.
4. FOR ALL such sequences, WHEN `next` returns a Verdict, THE Verdict SHALL have `needed` equal to the empty array.
5. FOR ALL Knowledge_Bases that contain a dependency cycle, `start` SHALL throw an Engine_Error with code `CYCLE` that names the Facts on the cycle.
6. FOR ALL Knowledge_Bases with 0 Askable_Facts and no dependency cycle, `next` called on the Session from `start` SHALL return a Verdict without any `answer` call.
7. THE Engine SHALL cover this property in a file named `termination.props.test.ts` using fast-check, with at least 100 runs per property and with generated Knowledge_Bases of 0 to 30 Facts and 0 to 60 rules, including generated Knowledge_Bases with a dependency cycle for criterion 5.

### Requirement 19: Property — mode agreement

**User Story:** As a maintainer, I want consultation and audit to give the same answer for the same facts, so that the two modes can never disagree.

#### Acceptance Criteria

1. FOR ALL Knowledge_Bases without a dependency cycle and answer sets that satisfy Requirement 3, criteria 4 to 7, WHEN `next` returns a Verdict, THE Engine SHALL make `audit`, called with the same Knowledge_Base and the same answers as the facts record, return a Verdict Deep_Equal to that Verdict.
2. FOR ALL Knowledge_Bases without a dependency cycle and answer sets that satisfy Requirement 3, criteria 4 to 7, WHEN `next` returns a Question, THE Engine SHALL make `audit`, called with the same Knowledge_Base and the same answers as the facts record, return a Verdict whose `needed` holds at least one Question and whose first Question is Deep_Equal to the Question from `next`.
3. FOR ALL Knowledge_Bases without a dependency cycle and answer sets that satisfy Requirement 3, criteria 4 to 7, WHEN `audit` returns a Verdict whose `needed` is not empty, THE Engine SHALL return from `audit` a `needed` array whose first Question has the same `fact` as the Question that `next` returns for a Session holding the same answers.
4. FOR ALL Knowledge_Bases without a dependency cycle and answer sets that satisfy Requirement 3, criteria 4 to 7, THE Engine SHALL give every Goal that is Decided under the original answers the same value in the `goals` of the `audit` Verdict as in the Verdict that `next` returns after the Session is driven to the end by answering each returned Question, with a value chosen by the test generator that is valid for the Question's Fact, until `next` returns a Verdict.
5. FOR ALL Knowledge_Bases without a dependency cycle and answer sets that satisfy Requirement 3, criteria 4 to 7, THE Engine SHALL give every `LineItem` whose Fact is Decided under the original answers the same `value`, `rule` and `clause` in the `audit` Verdict as in the Verdict that `next` returns after the Session is driven to the end as described in criterion 4.
6. IF `audit` and `next` are called with the same invalid answer, meaning an answer that breaks Requirement 3, criteria 4 to 7, THEN THE Engine SHALL throw from both calls an Engine_Error with the same `code`.
7. THE Engine SHALL cover this property in a file named `mode-agreement.props.test.ts` using fast-check, with at least 100 runs per property (Requirement 23, criterion 3), and with a generator that includes answer sets of size 0, size 1 and size equal to the number of Askable_Facts.

### Requirement 20: Property — replay

**User Story:** As a user, I want a verdict link to give the same verdict every time I open it, so that I can trust and share it.

#### Acceptance Criteria

1. FOR ALL Knowledge_Bases and valid Sessions, `next` called on the result of `decode(kb, encode(s))` SHALL return a result Deep_Equal to `next` called on the original Session `s`.
2. FOR ALL Knowledge_Bases, valid Sessions and Fact names declared in `Knowledge_Base.facts`, `explain` called on the decoded Session SHALL return a Proof_Tree Deep_Equal to `explain` called on the original Session.
3. FOR ALL Knowledge_Bases and valid Sessions, `audit` called with the answers of the decoded Session SHALL return a Verdict Deep_Equal to `audit` called with the answers of the original Session.
4. FOR ALL Knowledge_Bases and valid Sessions, `decode(kb, encode(s))` SHALL be Deep_Equal to `s` (round-trip), and FOR ALL Replay_Tokens `t` returned by `encode` for the Knowledge_Base, `encode(decode(kb, t))` SHALL equal `t` (inverse round-trip).
5. FOR ALL valid Sessions, including Sessions with zero answers, and Sessions with 64 answers of 64 characters each, the round-trip in criterion 4 SHALL hold.
6. FOR ALL Replay_Tokens produced by `encode` and then altered by one edit (changing one character, inserting one character from `A-Z`, `a-z`, `0-9`, `-` or `_`, or deleting one character), `decode` SHALL either return a Session or throw an Engine_Error, and SHALL throw no other kind of exception.
7. FOR ALL Replay_Tokens altered as in criterion 6 where `decode` returns a Session, `encode` of that Session SHALL differ from the original token only if the altered token was not the canonical encoding of that Session, and `encode(decode(kb, t'))` SHALL be a Replay_Token that `decode` accepts and maps to a Deep_Equal Session.
8. FOR ALL pairs of Knowledge_Bases that differ in exactly one rule (its `id`, `set`, `when`, `to`, `because` or `cite`), `decode` called with the second Knowledge_Base and a Replay_Token encoded for the first SHALL throw an Engine_Error with code `KB_MISMATCH`.
9. FOR ALL valid Sessions, THE Engine SHALL give the same Replay_Token and the same `next` result whether the answers were added in one order or in any permutation of that order.
10. THE Engine SHALL cover this property in a file named `replay.props.test.ts` using fast-check, running each property at least 100 runs, with generators that include Sessions holding every Fact type (`boolean`, `number`, `money`, `date`, `enum`).

### Requirement 21: Property — no internal symbol and plain JSON at the boundary

**User Story:** As an interface developer, I want a test that proves no internal symbol escapes, so that I can rely on plain JSON everywhere.

#### Acceptance Criteria

1. THE Engine SHALL cover this property in a file named `public-values.props.test.ts` using fast-check, running each property with at least 100 runs.
2. FOR ALL Knowledge_Bases, Sessions and Fact names generated by the test, a recursive walk over every Public_Value returned by `start`, `answer`, `next`, `audit`, `explain`, `whatIf`, `encode` and `decode` SHALL find no value of type `symbol`, including the `UNKNOWN` symbol, at any depth, in any property value or array element.
3. FOR ALL such Public_Values, the walk SHALL find only plain objects, arrays, strings, finite numbers, booleans and `undefined`, and SHALL find `undefined` only as the value of an optional or unknown property.
4. FOR ALL such Public_Values, the walk SHALL find no `NaN`, `Infinity`, `-Infinity`, `function`, `bigint`, `null`, or object whose prototype is not `Object.prototype` or `Array.prototype`.
5. FOR ALL such Public_Values, `JSON.parse(JSON.stringify(v))` SHALL be Deep_Equal to `v`.
6. WHEN the generated Session leaves at least one Fact Unknown, THE generator SHALL produce at least one case in which a Goal value in `Verdict.goals` is `undefined`, at least one case in which a `LineItem.value` is `undefined`, and at least one case in which a `ProofNode.value` is `undefined`.
7. WHEN the generated Session leaves a Derived_Fact inapplicable, meaning every rule guard for it evaluates to `false`, THE generator SHALL produce at least one case in which that Fact's value in a Verdict or ProofNode is `undefined`.
8. IF the walk finds a value that breaks criterion 2, 3 or 4, THEN THE test SHALL fail and report the path of the offending value, using property names and array indexes from the root Public_Value, together with the Engine function that returned it.
9. IF an Engine function throws while the test runs, THEN THE test SHALL accept the exception only when it is an Engine_Error, and SHALL fail on any other exception.
10. WHEN the generated Session answers a `number`, `money` or `date` Fact that a rule comparison probes, THE generator SHALL produce at least one case in which `whatIf` returns an Alternative for that Fact, and the walk of criteria 2 to 5 SHALL apply to it.

### Requirement 22: Performance benchmark

**User Story:** As an interface developer, I want one consultation step to take under 10 ms, so that the interface responds without a visible delay.

#### Acceptance Criteria

1. THE Engine SHALL include a benchmark test in a file named `consultation-step.perf.test.ts` that runs to completion, with a pass or fail result, under the single-run command `pnpm vitest run` and not under a watch mode or `vitest bench`.
2. THE benchmark test SHALL use a Benchmark_KB that has at least 50 Facts, at least 100 rules and at least 3 Goals, and that contains at least one rule each using a guard, `if`, `min`, `max` and `days_between`.
3. THE benchmark test SHALL build the measured Session from the Benchmark_KB by answering exactly half of the Benchmark_KB's Askable_Facts (rounded down), with each answer valid under Requirement 3, criterion 7.
4. WHEN the benchmark test starts, THE benchmark test SHALL run at least 20 warm-up Consultation_Steps and discard their durations before measuring.
5. WHEN the warm-up has finished, THE benchmark test SHALL measure the wall-clock duration, in milliseconds, of at least 200 Consultation_Steps, each on the Session from criterion 3.
6. IF the median of the measured durations is 10 ms or more, THEN THE benchmark test SHALL fail with a message that states the median and the 10 ms limit.
7. IF the maximum of the measured durations is 50 ms or more, THEN THE benchmark test SHALL fail with a message that states the maximum and the 50 ms limit.
8. WHEN the measured Consultation_Steps have finished, THE benchmark test SHALL print the median, the 95th percentile and the maximum durations in milliseconds, each rounded to 3 decimal places, whether the test passes or fails.
9. THE benchmark test SHALL read the clock only inside the test file, so that the Engine's source files keep the no-clock rule of Requirement 1, criterion 6.

### Requirement 23: Test tooling and working constraints

**User Story:** As a maintainer, I want one test setup and one set of working rules, so that every task runs the same way for people and agents.

#### Acceptance Criteria

1. THE Engine SHALL use Vitest as the unit and integration test runner and fast-check as the property-test library, with fast-check declared under `devDependencies` only and absent from `dependencies` in `packages/engine/package.json`.
2. THE Engine SHALL name every property-test file with the suffix `.props.test.ts`, so that `pnpm test:props` runs every such file and no file without that suffix.
3. THE Engine SHALL configure every fast-check property to run at least 100 times.
4. WHEN a task is marked complete, THE Engine SHALL have passed `pnpm check` (Biome lint and format check, `tsc --noEmit`, Vitest unit and property tests) with exit code 0 and zero reported errors.
5. WHEN a task runs tests, THE task SHALL use only single-run commands (`pnpm vitest run <path>`, `pnpm test:props` or `pnpm check`), and SHALL NOT start Vitest in watch mode or any other long-running process.
6. WHILE a task in the task list is in progress, THE task list SHALL start no other task, and SHALL start tasks in the order listed.
7. WHEN a task runs a command, THE task SHALL run it under Node major version 22, as pinned in `.nvmrc`.
8. THE Engine SHALL leave `packages/engine/src/types.ts` unchanged by this spec, except for adding the single optional property `readonly label?: string` to `FactDef`.
9. IF any change to `packages/engine/src/types.ts` other than the `label` property of criterion 8 is needed, THEN THE task list SHALL record it as a written proposal for approval by both lanes and SHALL NOT apply it.
10. THE Engine SHALL contain no import in any non-test source file under `packages/engine/src` that resolves to a path outside `packages/engine/src`.
11. THE Engine SHALL set `LineItem.label` to `FactDef.label` when it is present, and to the Derived_Label of the Fact name when it is absent (Requirement 7, criteria 5 and 6).
12. THE task list SHALL include a task that adds the optional `readonly label?: string` to `FactDef` in `packages/engine/src/types.ts`.
13. THE task list SHALL include a task that adds the optional `label` property to the fact properties table in `docs/kb-format.md`.
14. THE task list SHALL include a task that records a note for the kb-tools spec to add the optional `label` to its schema.

---

## Resolved decisions

The human has decided the five questions that were open. No question remains open.

1. **Label: approved by both lanes.** The contract change is an optional `readonly label?: string` on `FactDef`, plus an optional `label` in `docs/kb-format.md` and a note for the kb-tools schema. The Engine uses `FactDef.label` when present and the Derived_Label otherwise (Requirement 7, criteria 5 and 6; Requirement 23, criteria 8 and 11 to 14). Reason: the ledger needs readable names such as "Room rent above the limit", and a name derived from `room_rent_excess` is a fallback, not a main-screen name.
2. **Inapplicable derived facts: keep `undefined`.** When every rule guard for a Derived_Fact is `false`, the Engine reports `undefined` (Requirement 4, criterion 7). Authors who want `0` write a last rule with no guard. The kb-tools validator, not the Engine, warns about a missing fallback (see "Notes for the kb-tools spec").
3. **`FactSource` value `"collected"`: no contract change.** The Engine returns `"answered"` for every non-derived leaf (Requirement 9, criterion 3). The Pre-Flight interface knows which Facts its collector supplied and relabels them itself.
4. **Money precision: fail loudly.** A rule that gives a non-integer to a `money` Fact throws `NON_INTEGER_MONEY` naming the rule id (Requirement 4, criteria 14 to 17; Requirement 13). Money is whole paise, so a fraction would put a fractional amount into a payout. Authors write `round(...)`, and kb-tools tests catch a missing round at build time.
5. **What-if for number, money and date: threshold probing** (Requirement 10, criteria 10 to 20), with at most 6 candidates per Fact. Rationale: the showcase line "Room rent at or below ₹5,000 a day: + ₹38,000" is a money answer.

Informational note (no Engine action): a Replay_Token is tied to the exact rules version. If the rules change, an old link gives a clear `KB_MISMATCH` error ("rules have changed") instead of a different verdict (Requirement 11, criterion 7). That is the right behaviour for "same link, same verdict".

## Notes for the kb-tools spec

These notes are for the kb-tools spec to pick up. They add no Engine criteria.

1. The kb-tools schema SHALL accept the optional `label` string on a fact, matching `FactDef.label`.
2. The kb-tools validator SHALL warn when a Fact with role `deduction` has no unguarded fallback rule, because the Engine reports `undefined` for such a Fact when every guard is `false`.
3. The kb-tools tests SHALL catch any `money` rule that lacks an explicit `round(...)`, so that `NON_INTEGER_MONEY` is found at build time and not in front of a user.
