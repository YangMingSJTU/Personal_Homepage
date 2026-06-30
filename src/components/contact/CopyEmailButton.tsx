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
      className="stone-button stone-button-primary"
      aria-label="Copy email"
    >
      <span className="stone-button-label">{copied ? "Copied" : "Copy email"}</span>
      <Icon className="stone-button-icon h-4 w-4" aria-hidden="true" />
    </button>
  );
}
