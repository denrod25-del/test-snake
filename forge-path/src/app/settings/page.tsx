import type { Metadata } from "next";
import { SettingsPanel } from "@/components/SettingsPanel";

export const metadata: Metadata = {
  title: "Settings | Forge Path",
};

export default function SettingsPage() {
  return <SettingsPanel />;
}
