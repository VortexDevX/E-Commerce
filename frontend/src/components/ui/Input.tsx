import React, { forwardRef } from "react";

function cn(...a: (string | false | undefined | null)[]) {
  return a.filter(Boolean).join(" ");
}

type Props = React.InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  error?: string;
  hint?: string;
  wrapperClassName?: string;
};

const Input = forwardRef<HTMLInputElement, Props>(function Input(
  { label, error, hint, className, wrapperClassName, ...props },
  ref
) {
  return (
    <label className={cn("block space-y-1", wrapperClassName)}>
      {label && <span className="text-sm text-gray-700">{label}</span>}
      <input
        ref={ref}
        {...props}
        className={cn(
          "w-full bg-white border border-gray-300 rounded px-3 py-2",
          "text-gray-900 placeholder-gray-400",
          "focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400",
          className
        )}
      />
      {hint && !error && <span className="text-xs text-gray-500">{hint}</span>}
      {error && <span className="text-xs text-rose-600">{error}</span>}
    </label>
  );
});

export default Input;
