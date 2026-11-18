# Claim Check: open questions

Questions the policy (`rulebook/policy.md`) left open. The human answered all nine. Each row gives the decision and what the rules do.

| # | Clause | Question | Status | Decision |
| --- | --- | --- | --- | --- |
| 1 | 3.1 | An illness starts before the policy start date. Is it covered? | Answered | Not covered. Clause 3.1 now says so, in one added sentence. `WAIT-01` counts the days from the policy start date to the illness start date. A negative count is less than 30, so the claim is not paid. |
| 2 | 1.3, 3.1, 5.1, 5.2 | Two of clauses 3.1, 5.1 and 5.2 apply to one claim. The full bill is deducted once. Which clause is named in the ledger? | Answered | Keep. The first in the order the clause lists them: 3.1, then 5.1, then 5.2. `EXCL-02` and `ABROAD-01` deduct nothing when an earlier one applies. |
| 3 | 5.1 | Dental treatment is covered "unless an accident caused the need for it". Is that the same as the cause of the admission being an accident? | Answered | Keep. Yes. `EXCL-01` treats dental treatment as covered only when `cause` is `accident`. |
| 4 | 5.1 | Cosmetic surgery or weight-loss treatment that follows an accident. The clause makes no accident exception for these two. | Answered | Keep. They are never covered, whatever the cause. |
| 5 | 2.2 | May the sum insured be any amount, or only ₹3,00,000, ₹5,00,000 or ₹10,00,000? | Answered | Only the three amounts. `sum_insured` is an enum with the options `three_lakh`, `five_lakh` and `ten_lakh`. `SUM-01` turns the answer into the money fact `year_cover` (in paise), and `ROOM-03` and `SUM-02` read `year_cover`. |
| 6 | 1.2, 4.1, 5.3 | The Annexure 1 amount, or the room charges, is more than the hospital bill. What are other charges then? | Answered | No worked-out amount goes below zero. Clause 1.3 now says so, in one added sentence. Other charges (`ROOM-02`), the admissible claim (`COPAY-02`), the amount after co-payment (`SUM-03`) and the payable amount (`PAY-02`) are floored at zero. Other charges payable and the other-charges deduction follow from other charges and cannot go below zero. Scenario `G-17` covers it. |
| 7 | 1.3 | Rounding applies to "every amount worked out". An answer typed with paise, such as a bill of ₹1,000.50, is an input and not worked out. | Answered | Keep. Every worked-out amount is rounded to a whole rupee, half up. Inputs are used as given. The payable amount is rounded, so with such an input the ledger can differ from the bill by under one rupee. |
| 8 | 2.3 | "The same policy year" and "claims already paid". Who works out the amount already paid? | Answered | Keep. The policyholder answers `paid_this_year`. The rules do not check it. |
| 9 | 1.1, 2.1, 7.1, 7.2 | These clauses change no amount. | Answered | Keep. No rule cites them. |

## Effects of answers 5 and 6 to watch

- The zero floor applies to worked-out amounts only. A deduction that comes straight from an input is not floored: with an Annexure 1 amount above the bill, the Annexure 1 deduction is that amount, so the deductions can add up to more than the bill. The payable amount is then zero. The app should still reject an Annexure 1 amount above the bill.
- Money answers (the bill, room rent, Annexure 1 items, amounts already paid) are inputs, and the rules do not check that they are zero or more. The app should.
