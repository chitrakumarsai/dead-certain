# Claim Check: open questions

Questions the policy (`rulebook/policy.md`) leaves open. The knowledge base does not guess. Where a rule had to behave one way, the question says which, so a human can change it.

| # | Clause | Question | What the rules do now |
| --- | --- | --- | --- |
| 1 | 3.1 | An illness starts before the policy start date. Is it covered? The clause covers only a start date "less than 30 days after" and "30 or more days after" the policy start. | `WAIT-01` counts the days from the policy start date to the illness start date. A negative count is less than 30, so the claim is not paid. |
| 2 | 1.3, 3.1, 5.1, 5.2 | Two of clauses 3.1, 5.1 and 5.2 apply to one claim. The full bill is deducted once. Which clause is named in the ledger? | The first in the order the clause lists them: 3.1, then 5.1, then 5.2. `EXCL-02` and `ABROAD-01` deduct nothing when an earlier one applies. |
| 3 | 5.1 | Dental treatment is covered "unless an accident caused the need for it". Is that the same as the cause of the admission being an accident? | Yes. `EXCL-01` treats dental treatment as covered only when `cause` is `accident`. |
| 4 | 5.1 | Cosmetic surgery or weight-loss treatment that follows an accident. The clause makes no accident exception for these two. | They are never covered, whatever the cause. |
| 5 | 2.2 | May the sum insured be any amount, or only ₹3,00,000, ₹5,00,000 or ₹10,00,000? | The rules accept any amount. The three-amount check belongs to the app's input, not to a rule. |
| 6 | 1.2, 4.1, 5.3 | The Annexure 1 amount, or the room charges, is more than the hospital bill. The clauses do not say what other charges are then. | The rules do the subtraction as written, so other charges can be negative. The app should reject such answers. |
| 7 | 1.3 | Rounding applies to "every amount worked out". An answer typed with paise, such as a bill of ₹1,000.50, is an input and not worked out. | Every worked-out amount is rounded to a whole rupee, half up. Inputs are used as given. The payable amount is rounded, so with such an input the ledger can differ from the bill by under one rupee. |
| 8 | 2.3 | "The same policy year" and "claims already paid". Who works out the amount already paid? | The policyholder answers `paid_this_year`. The rules do not check it. |
| 9 | 1.1, 2.1, 7.1, 7.2 | These clauses change no amount. | No rule cites them. |
