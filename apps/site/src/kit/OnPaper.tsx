import { Sheet } from "@dead-certain/ui";
import type { ReactNode } from "react";

/** The real paper sheet, for specimens of components that sit on paper in the apps. */
export function OnPaper({ children }: { children: ReactNode }) {
	return <Sheet>{children}</Sheet>;
}
