"use client";

export function PasswordEye({
  visible,
  onToggle,
}: {
  visible: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label="Toggle password visibility"
      className="flex size-6 items-center justify-center"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={visible ? "/brand/eye_enable.svg" : "/brand/eye_disable.svg"}
        alt=""
        width={20}
        height={20}
        aria-hidden
      />
    </button>
  );
}
