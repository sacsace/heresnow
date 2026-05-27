import Image from "next/image";
import Link from "next/link";
import { logoCircle, logoCircleAuth, logoTitle, logoTitleAuth } from "@/lib/uiStyles";

type Props = {
  href?: string;
  /** header: nav bar · auth: login/signup card */
  variant?: "header" | "auth";
  /** Program name beside logo (default: HeresNow) */
  title?: string;
  className?: string;
};

export function AppLogo({
  href,
  variant = "header",
  title = "HeresNow",
  className = "",
}: Props) {
  const frameClass = variant === "auth" ? logoCircleAuth : logoCircle;
  const titleClass = variant === "auth" ? logoTitleAuth : logoTitle;
  const wrapClass =
    variant === "auth"
      ? "inline-flex flex-col items-center gap-2.5 sm:gap-3"
      : "inline-flex min-w-0 max-w-full items-center gap-2 sm:gap-2.5";
  const mark = (
    <span className={`${frameClass} ${className}`.trim()}>
      <Image
        src="/logo.png"
        alt=""
        fill
        sizes={variant === "auth" ? "48px" : "40px"}
        className="object-contain object-center p-[11%]"
        priority={variant === "auth"}
        aria-hidden
      />
    </span>
  );

  const content = (
    <span className={wrapClass}>
      {mark}
      {title ? (
        <span className={`${titleClass} ${variant === "header" ? "hidden sm:inline" : ""}`}>
          {title}
        </span>
      ) : null}
    </span>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="inline-flex min-w-0 shrink-0 items-center"
        aria-label={title || "HeresNow"}
      >
        {content}
      </Link>
    );
  }

  return content;
}
