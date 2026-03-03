"use client";
import { ToastProvider } from "@/components/ToastProvider";
import DropdownMenu from "@/components/DropdownMenu";
import GlobalClientUI from "@/components/GlobalClientUI";

export default function ClientRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ToastProvider />
      <DropdownMenu />
      <GlobalClientUI />
      {children}
    </>
  );
}
