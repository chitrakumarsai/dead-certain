import { AppShell, type XrayTarget } from "@dead-certain/ui";
import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import { compiledKb, NAV } from "./config";
import { Hero } from "./Hero";
import { heroModel } from "./hero/model";
import { isKnowledgeBase } from "./kbShape";

const kb = isKnowledgeBase(compiledKb) ? compiledKb : null;
// Worked out once, before the first paint, so the verdict needs no placeholder (2.10).
const model = kb === null ? null : heroModel(kb);

function Landing() {
	const [open, setOpen] = useState<XrayTarget | null>(null);
	return (
		<AppShell appName="Dead Certain" nav={NAV}>
			<Hero
				model={model}
				open={open}
				onOpen={setOpen}
				onClose={() => setOpen(null)}
			/>
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
