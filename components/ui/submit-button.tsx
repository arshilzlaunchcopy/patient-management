"use client";

import { useFormStatus } from "react-dom";
import { Spinner } from "./spinner";

/**
 * Submit button for plain `<form action={serverAction}>` forms. Shows a
 * spinner and disables itself while the action runs, so a slow connection
 * never looks like a dead button. Must be rendered inside the form.
 */
export function SubmitButton({
  children,
  pendingText,
  className,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { pendingText?: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || rest.disabled}
      aria-busy={pending || undefined}
      className={className}
      {...rest}
    >
      {pending ? (
        <>
          <Spinner className="mr-2" />
          {pendingText ?? children}
        </>
      ) : (
        children
      )}
    </button>
  );
}
