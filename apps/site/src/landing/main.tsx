import { AppShell, type XrayTarget } from "@dead-certain/ui";
import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import "@dead-certain/ui/styles.css";
import "./styles.css";
import { Apps } from "./Apps";
import { compiledKb, NAV } from "./config";
import { Hero } from "./Hero";
import { STEP_RULE } from "./hero/config";
import { heroModel } from "./hero/model";
import { isKnowledgeBase } from "./kbShape";
import { Scaffold } from "./Scaffold";
import { Steps } from "./Steps";
import { steps } from "./stepsData";

const kb = isKnowledgeBase(compiledKb) ? compiledKb : null;
// Worked out once, before the first paint, so the verdict needs no placeholder (2.10).
const model = kb === null ? null : heroModel(kb);
const stepsData = kb === null ? null : steps(kb, STEP_RULE);
const hasVerdict = model !== null && !("kind" in model);

function Landing() {
	const [open, setOpen] = useState<XrayTarget | null>(null);
	return (
		<AppShell appName="" nav={NAV}>
			<Hero
				model={model}
				open={open}
				onOpen={setOpen}
				onClose={() => setOpen(null)}
			/>
			<Steps
				data={stepsData}
				{...(hasVerdict
					? { onOpenProof: () => setOpen({ kind: "verdict" }) }
					: {})}
			/>
			<Apps />
			<Scaffold />
		</AppShell>
	);
}

const root = document.getElementById("root");
if (!root) throw new Error("index.html has no #root element");
createRoot(root).render(
	<StrictMode>
		<Landing />
	</StrictMode>,
);
