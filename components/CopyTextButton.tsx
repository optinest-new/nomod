"use client";

import { useState } from "react";

type CopyTextButtonProps = {
  value: string;
  className?: string;
  label?: string;
};

export function CopyTextButton({
  value,
  className,
  label = "Copy path",
}: CopyTextButtonProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button type="button" className={className} onClick={handleCopy}>
      {copied ? "Copied" : label}
    </button>
  );
}

