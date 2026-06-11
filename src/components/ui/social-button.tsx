"use client";

import { cn } from "@/lib/utils";

interface SocialButtonProps {
  label: string;
  iconSrc: string;
  variant: "google" | "apple";
  onClick?: () => void;
  disabled?: boolean;
}

export function SocialButton({
  label,
  iconSrc,
  variant,
  onClick,
  disabled,
}: SocialButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex h-12 w-full items-center justify-center gap-3 rounded-[10px] px-4 text-sm font-medium transition-opacity disabled:opacity-60",
        variant === "apple"
          ? "bg-black text-white"
          : "border border-black/40 bg-white text-black",
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={iconSrc} alt="" width={20} height={20} aria-hidden />
      <span>{label}</span>
    </button>
  );
}
