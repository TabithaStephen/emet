"use client";

import type {
  InputHTMLAttributes,
  ReactNode,
  TextareaHTMLAttributes,
} from "react";
import { useId } from "react";

const control =
  "w-full rounded-md border border-border bg-background-secondary px-3.5 py-2.5 text-sm text-foreground placeholder:text-foreground-muted/60 transition-colors duration-200 hover:border-silver/25 focus:border-accent/60 focus:outline-none";

interface LabelledProps {
  label: string;
  hint?: string;
  children?: ReactNode;
}

export function FieldShell({
  label,
  hint,
  htmlFor,
  children,
}: LabelledProps & { htmlFor: string }) {
  return (
    <div className="space-y-2">
      <label
        htmlFor={htmlFor}
        className="block text-[0.7rem] font-medium uppercase tracking-[0.14em] text-foreground-muted"
      >
        {label}
      </label>
      {children}
      {hint ? <p className="text-xs leading-relaxed text-foreground-muted/80">{hint}</p> : null}
    </div>
  );
}

type TextFieldProps = LabelledProps & InputHTMLAttributes<HTMLInputElement>;

export function TextField({ label, hint, className = "", ...props }: TextFieldProps) {
  const id = useId();
  return (
    <FieldShell label={label} hint={hint} htmlFor={id}>
      <input id={id} className={`${control} ${className}`} {...props} />
    </FieldShell>
  );
}

type TextAreaFieldProps = LabelledProps &
  TextareaHTMLAttributes<HTMLTextAreaElement>;

export function TextAreaField({
  label,
  hint,
  className = "",
  rows = 3,
  ...props
}: TextAreaFieldProps) {
  const id = useId();
  return (
    <FieldShell label={label} hint={hint} htmlFor={id}>
      <textarea
        id={id}
        rows={rows}
        className={`${control} resize-y leading-relaxed ${className}`}
        {...props}
      />
    </FieldShell>
  );
}

export { control as fieldControlClass };
