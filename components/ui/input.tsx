import * as React from "react";
import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          "surface-muted flex h-12 w-full rounded-2xl px-4 text-sm text-white outline-none ring-0 placeholder:text-slate-500 focus:border-cyan-300/30",
          className
        )}
        {...props}
      />
    );
  }
);

Input.displayName = "Input";

export { Input };
