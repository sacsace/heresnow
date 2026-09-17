type Props = {
  count: number;
  className?: string;
};

export function NavCountBadge({ count, className = "" }: Props) {
  if (count <= 0) return null;
  const label = count > 99 ? "99+" : String(count);
  return (
    <span
      aria-label={label}
      className={`inline-flex min-h-[1.125rem] min-w-[1.125rem] shrink-0 items-center justify-center rounded-full bg-[var(--apple-red)] px-1 text-[0.625rem] font-bold leading-none text-white ${className}`.trim()}
    >
      {label}
    </span>
  );
}
