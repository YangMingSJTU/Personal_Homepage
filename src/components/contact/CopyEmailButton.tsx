import { Check, Copy } from "lucide-react";
import React from "react";
import { useState } from "react";

type CopyEmailButtonProps = {
  email: string;
};

export default function CopyEmailButton({ email }: CopyEmailButtonProps) {
  const [copied, setCopied] = useState(false);

  async function copyEmail() {
    await navigator.clipboard.writeText(email);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  const Icon = copied ? Check : Copy;

  return (
    <button
      type="button"
      onClick={copyEmail}
      className="group relative inline-flex min-h-11 items-center justify-center gap-2 overflow-hidden rounded-full border border-cyan/40 bg-cyan/10 px-5 py-2.5 text-sm font-semibold text-white shadow-glow transition hover:bg-cyan/20 focus:outline-none focus:ring-2 focus:ring-cyan/70"
      aria-label="Copy email"
    >
      <span className="absolute left-3 h-2 w-2 rounded-full bg-stone/80 transition group-hover:scale-[2.8] group-hover:bg-cyan/25" />
      <span className="relative ml-2">{copied ? "Copied" : "Copy email"}</span>
      <Icon className="relative h-4 w-4" aria-hidden="true" />
    </button>
  );
}
