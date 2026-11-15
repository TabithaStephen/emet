import type { ButtonHTMLAttributes } from "react";
import Link from "next/link";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

const base =
  "inline-flex items-center justify-center gap-2 rounded-md font-medium tracking-tight transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-40";

const variants: Record<Variant, string> = {
  primary:
    "bg-accent text-background hover:bg-accent/85 active:bg-accent/75",
  secondary:
    "border border-border bg-surface-elevated text-foreground hover:border-silver/30 hover:bg-surface-elevated/70",
  ghost:
    "text-foreground-muted hover:bg-surface-elevated hover:text-foreground",
  danger:
    "border border-critical/40 text-critical hover:bg-critical/10",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-10 px-5 text-sm",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md") {
  return `${base} ${variants[variant]} ${sizes[size]}`;
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: ButtonProps) {
  return <button className={`${buttonClass(variant, size)} ${className}`} {...props} />;
}

interface ButtonLinkProps {
  href: string;
  variant?: Variant;
  size?: Size;
  className?: string;
  children: React.ReactNode;
}

export function ButtonLink({
  href,
  variant = "primary",
  size = "md",
  className = "",
  children,
}: ButtonLinkProps) {
  return (
    <Link href={href} className={`${buttonClass(variant, size)} ${className}`}>
      {children}
    </Link>
  );
}
