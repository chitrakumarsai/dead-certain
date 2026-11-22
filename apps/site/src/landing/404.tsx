import { AppShell } from "@dead-certain/ui";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@dead-certain/ui/styles.css";
import "./styles.css";
import { NAV } from "./config";
import { NotFound } from "./NotFound";

const root = document.getElementById("root");
if (!root) throw new Error("404.html has no #root element");
createRoot(root).render(
	<StrictMode>
		<AppShell appName="" nav={NAV}>
			<NotFound />
		</AppShell>
	</StrictMode>,
);
