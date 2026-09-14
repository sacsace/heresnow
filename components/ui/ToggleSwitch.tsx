"use client";

type Props = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  id?: string;
  ariaLabel: string;
};

export function ToggleSwitch({ checked, onChange, disabled, id, ariaLabel }: Props) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-[1.875rem] w-[3.25rem] shrink-0 items-center rounded-full transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--apple-blue)] disabled:cursor-not-allowed disabled:opacity-45 ${
        checked ? "bg-[var(--apple-green)]" : "bg-[var(--fill-secondary)] ring-1 ring-inset ring-black/[0.08]"
      }`}
    >
      <span
        aria-hidden
        className={`inline-block h-[1.625rem] w-[1.625rem] transform rounded-full bg-white shadow-sm transition-transform duration-200 ${
          checked ? "translate-x-[1.4375rem]" : "translate-x-[0.125rem]"
        }`}
      />
    </button>
  );
}
