import { contrast } from "@dead-certain/ui";
import { useState } from "react";
import { Specimen } from "./Specimen";

/** Reads a colour token off the page, so hex values live in tokens.css only. */
function token(name: string): string {
	return getComputedStyle(document.documentElement)
		.getPropertyValue(`--${name}`)
		.trim();
}

type Floor = 4.5 | 3 | null;

// Each pair is drawn the way the kit uses it: foreground on background.
const PAIRS: { fg: string; bg: string; floor: Floor; use: string }[] = [
	{ fg: "ink", bg: "paper", floor: 4.5, use: "Body text" },
	{ fg: "ink-soft", bg: "paper", floor: 4.5, use: "Secondary text" },
	{ fg: "ink", bg: "lightbox", floor: 4.5, use: "Text on the page" },
	{ fg: "paid", bg: "paper", floor: 4.5, use: "Paid" },
	{ fg: "reduced", bg: "paper", floor: 4.5, use: "Reduced" },
	{ fg: "denied", bg: "paper", floor: 4.5, use: "Denied" },
	{ fg: "ink", bg: "wax", floor: 4.5, use: "Marked sentence" },
	{ fg: "bone", bg: "film", floor: 4.5, use: "Film text" },
	{ fg: "bone-soft", bg: "film", floor: 4.5, use: "Film secondary text" },
	{ fg: "wax", bg: "film", floor: 3, use: "Focus ring on film" },
	{ fg: "focus-paper", bg: "paper", floor: 3, use: "Focus ring on paper" },
	{ fg: "hairline", bg: "paper", floor: null, use: "Decorative only" },
];

function Swatch({ fg, bg, floor, use }: (typeof PAIRS)[number]) {
	const ratio = contrast(token(fg), token(bg)).toFixed(2);
	return (
		<li className="border border-divider rounded-paper">
			<div
				className="flex h-24 items-center px-4"
				style={{ background: `var(--${bg})`, color: `var(--${fg})` }}
			>
				{floor === 4.5 ? (
					<span className="font-doc text-verdict">Aa</span>
				) : (
					<span className="block h-12 w-12 rounded-control border-2 border-current" />
				)}
			</div>
			<dl className="border-t border-divider bg-paper p-3 text-sys-small">
				<dt className="font-mono text-mono">
					{fg} on {bg}
				</dt>
				<dd className="figures">{ratio}:1</dd>
				<dd className="text-text-soft">
					{use}
					{floor ? `, floor ${floor}:1` : ""}
				</dd>
			</dl>
		</li>
	);
}

// Real copy from the two apps, one line per style.
const TYPE_STYLES = [
	{
		id: "verdict",
		className: "font-doc text-verdict",
		name: "Document, verdict 48/56 (36/44 on phones)",
		sample: "₹1,42,500 of ₹2,10,000 will be paid",
	},
	{
		id: "doc-body",
		className: "font-doc text-doc-body",
		name: "Document, body 17/28",
		sample:
			"Room rent is limited to 1% of the sum insured per day. Where the rent is higher, other charges reduce in the same ratio.",
	},
	{
		id: "doc-fine",
		className: "font-doc text-doc-fine",
		name: "Document, fine print 14/22",
		sample: "Uses a sample policy written for this demo.",
	},
	{
		id: "question",
		className: "font-sys text-question font-semibold",
		name: "System, question 24/32 (21/28 on phones)",
		sample: "What was the room rent per day?",
	},
	{
		id: "sys-body",
		className: "font-sys text-sys-body",
		name: "System, body 17/26",
		sample:
			"The policy caps room rent, and a higher rent reduces other charges too.",
	},
	{
		id: "sys-small",
		className: "font-sys text-sys-small",
		name: "System, small 14/20",
		sample: "Question 3. Up to 6 more.",
	},
	{
		id: "mono",
		className: "font-mono text-mono",
		name: "Machine 14/22",
		sample: "ROOM-02  room_rent_per_day > room_rent_cap",
	},
];

const SPACING = ["1", "2", "3", "4", "6", "8", "12", "16", "24"];

const RADII = [
	{ name: "paper", px: 4, className: "border border-divider bg-paper" },
	{
		name: "control",
		px: 6,
		className: "border border-control-border bg-paper",
	},
	{ name: "film", px: 8, className: "bg-film" },
];

const DURATIONS = [
	{ name: "press", ms: 120, use: "Button press" },
	{ name: "panel", ms: 200, use: "Panel open and close" },
	{ name: "xray", ms: 500, use: "X-ray develop" },
];

function Replay({ name, ms, use }: (typeof DURATIONS)[number]) {
	const [isOn, setIsOn] = useState(false);
	return (
		<li className="flex items-center gap-4">
			<button
				type="button"
				aria-pressed={isOn}
				onClick={() => setIsOn(!isOn)}
				className="min-h-touch shrink-0 rounded-control border border-control-border bg-paper px-4 text-sys-small font-semibold"
			>
				Replay {ms} ms
			</button>
			<div className="h-2 grow bg-divider" aria-hidden="true">
				<div
					className="h-full origin-left bg-ink transition-transform ease-kit"
					style={{
						transitionDuration: `var(--dur-${name})`,
						transform: `scaleX(${isOn ? 1 : 0})`,
					}}
				/>
			</div>
			<span className="w-24 shrink-0 text-sys-small text-text-soft md:w-rail">
				{use}
			</span>
		</li>
	);
}

export const TOKEN_SPECIMENS = [
	{ id: "tokens-colour", title: "Colour" },
	{ id: "tokens-type", title: "Type" },
	{ id: "tokens-spacing", title: "Spacing" },
	{ id: "tokens-radius", title: "Radius" },
	{ id: "tokens-motion", title: "Motion" },
];

export function TokensSection() {
	return (
		<section aria-labelledby="tokens-heading">
			<h2 id="tokens-heading" className="font-doc text-verdict font-semibold">
				Tokens
			</h2>

			<Specimen
				id="tokens-colour"
				title="Colour"
				note="Each pair is drawn as the kit uses it, with its contrast ratio computed from the tokens."
			>
				<ul className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
					{PAIRS.map((pair) => (
						<Swatch key={`${pair.fg}-${pair.bg}`} {...pair} />
					))}
				</ul>
			</Specimen>

			<Specimen
				id="tokens-type"
				title="Type"
				note="One family, three voices: Serif for the rulebook and the verdict, Sans for the app, Mono for the logic."
			>
				<ul className="max-w-column">
					{TYPE_STYLES.map((style) => (
						<li
							key={style.id}
							data-type-style={style.id}
							className="border-t border-divider py-4"
						>
							<p className={style.className}>{style.sample}</p>
							<p className="pt-1 text-sys-small text-text-soft">{style.name}</p>
						</li>
					))}
				</ul>
			</Specimen>

			<Specimen
				id="tokens-spacing"
				title="Spacing"
				note="Nine steps on a 4 px base. No other spacing value compiles."
			>
				<ul>
					{SPACING.map((step) => (
						<li key={step} className="flex items-center gap-4 py-1">
							<span className="w-24 shrink-0 whitespace-nowrap font-mono text-mono">
								space-{step}
							</span>
							<span
								className="block h-4 bg-ink"
								style={{ width: `var(--space-${step})` }}
							/>
						</li>
					))}
				</ul>
			</Specimen>

			<Specimen
				id="tokens-radius"
				title="Radius"
				note="Radius marks the material: paper 4 px, controls 6 px, film 8 px."
			>
				<ul className="flex flex-wrap gap-6">
					{RADII.map((radius) => (
						<li key={radius.name}>
							<div
								className={`h-24 w-24 ${radius.className}`}
								style={{ borderRadius: `var(--radius-${radius.name})` }}
							/>
							<p className="pt-2 font-mono text-mono">
								{radius.name} {radius.px}px
							</p>
						</li>
					))}
				</ul>
			</Specimen>

			<Specimen
				id="tokens-motion"
				title="Motion"
				note="One curve, three durations. Only the X-ray develop is choreographed."
			>
				<ul className="max-w-column space-y-3 motion-reduce:hidden">
					{DURATIONS.map((duration) => (
						<Replay key={duration.name} {...duration} />
					))}
				</ul>
				<p className="hidden max-w-column motion-reduce:block">
					Panels change in 0 ms. Presses and the film fade take 120 ms. Nothing
					moves.
				</p>
			</Specimen>
		</section>
	);
}
