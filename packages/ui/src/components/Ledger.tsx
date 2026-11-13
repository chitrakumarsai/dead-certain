import type { LineItem } from "@dead-certain/engine/types";
import { formatMoney } from "../format/money";
import type { FormatContext } from "../types";

export interface LedgerProps {
	claimed: { label: string; value: number };
	/** Deductions, value in minor units. Zero items are left out. */
	items: readonly LineItem[];
	payable: { label: string; value: number };
	format: FormatContext;
	/** The row whose proof is open. */
	selectedFact?: string;
	/** `opener` is the row's button, so focus can return to it. */
	onOpen: (item: LineItem, opener: HTMLElement) => void;
}

const MINUS = "−";
// Cells ignore min-height: 12 px padding plus the 26 px line gives a 50 px row.
const LABEL = "w-full py-3 pr-2 text-left align-top [font-weight:inherit]";
const AMOUNT = "py-3 pl-2 text-right align-top whitespace-nowrap figures";

/**
 * The claim, each deduction with its clause, and the payable amount. Every
 * amount is printed as formatMoney returns it: the ledger adds nothing up.
 */
export function Ledger({
	claimed,
	items,
	payable,
	format,
	selectedFact,
	onOpen,
}: LedgerProps) {
	const money = (minor: number) =>
		formatMoney(minor, format.currency ?? "INR", format.locale);
	const shown = items.filter((item) => item.value !== 0);

	return (
		<table className="w-full max-w-column border-collapse text-sys-body text-text">
			<caption className="sr-only">Claim ledger</caption>
			<thead className="sr-only">
				<tr>
					<th scope="col">Item</th>
					<th scope="col">Clause</th>
					<th scope="col">Amount</th>
				</tr>
			</thead>
			<tbody>
				<tr>
					<th scope="row" className={LABEL}>
						{claimed.label}
					</th>
					<td />
					<td data-amount className={AMOUNT}>
						<span>{money(claimed.value)}</span>
					</td>
				</tr>
				{shown.map((item) => {
					const isKnown = typeof item.value === "number";
					const amount = isKnown
						? `${MINUS} ${money(Number(item.value))}`
						: "Not known yet";
					const spoken = isKnown
						? `minus ${money(Number(item.value))}`
						: "not known yet";
					return (
						<tr
							key={item.fact}
							aria-current={item.fact === selectedFact ? "true" : undefined}
							className="relative transition-colors duration-(--dur-press) ease-kit hover:bg-text/10 has-focus-visible:outline-2 has-focus-visible:outline-focus has-focus-visible:outline-solid aria-[current=true]:bg-text/10 aria-[current=true]:font-semibold"
						>
							<th scope="row" className={LABEL}>
								<button
									type="button"
									data-focus-ring="frame"
									aria-label={`${item.label}, clause ${item.clause}, ${spoken}. See why`}
									onClick={(event) => onOpen(item, event.currentTarget)}
									// The button covers the whole row, so any cell opens the proof.
									className="cursor-pointer text-left after:absolute after:inset-0 after:content-['']"
								>
									{item.label}
								</button>
							</th>
							<td
								data-clause
								// The body line height, so the clause sits on the label's first line.
								className="px-2 py-3 align-top font-mono text-mono leading-(--leading-sys-body) text-text-soft"
							>
								{item.clause}
							</td>
							<td data-amount className={AMOUNT}>
								<span>{amount}</span>
							</td>
						</tr>
					);
				})}
			</tbody>
			<tfoot>
				<tr className="border-t border-divider font-semibold">
					<th scope="row" className={LABEL}>
						{payable.label}
					</th>
					<td />
					<td data-amount className={AMOUNT}>
						<span>{money(payable.value)}</span>
					</td>
				</tr>
			</tfoot>
		</table>
	);
}
