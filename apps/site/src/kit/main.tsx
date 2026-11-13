import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@dead-certain/ui/styles.css";

function Gallery() {
	return (
		<div className="p-4 md:p-6">
			<a href="#content" className="text-sys-small underline">
				Skip to the content
			</a>
			<header className="pt-4">
				<h1 className="text-question font-semibold">Component kit</h1>
			</header>
			<main id="content" tabIndex={-1} />
		</div>
	);
}

const root = document.getElementById("root");
if (!root) throw new Error("kit/index.html has no #root element");
createRoot(root).render(
	<StrictMode>
		<Gallery />
	</StrictMode>,
);
