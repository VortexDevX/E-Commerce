import React, { forwardRef } from "react";

function cn(...a: (string | false | undefined | null)[]) {
  return a.filter(Boolean).join(" ");
}

type Props = React.SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string;
  error?: string;
  wrapperClassName?: string;
};

const Select = forwardRef<HTMLSelectElement, Props>(function Select(
  { label, error, className, wrapperClassName, children, ...props },
  ref
) {
  return (
    <label className={cn("block space-y-1", wrapperClassName)}>
      {label && <span className="text-sm text-gray-700">{label}</span>}
      <select
        ref={ref}
        {...props}
        className={cn(
          "w-full bg-white border border-gray-300 rounded px-3 py-2",
          "text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400",
          className
        )}
      >
        {children}
      </select>
      {error && <span className="text-xs text-rose-600">{error}</span>}
    </label>
  );
});

export default Select;
