import * as React from "react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  size?: "default" | "sm" | "lg" | "icon";
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = "", variant = "default", size = "default", ...props }, ref) => {
    let variantStyles = "bg-blue-600 text-white hover:bg-blue-700 shadow-sm";
    if (variant === "outline") {
      variantStyles = "border border-gray-300 bg-white hover:bg-gray-50 text-gray-800";
    } else if (variant === "ghost") {
      variantStyles = "hover:bg-gray-100 text-gray-800";
    } else if (variant === "secondary") {
      variantStyles = "bg-gray-100 text-gray-900 hover:bg-gray-200";
    } else if (variant === "destructive") {
      variantStyles = "bg-red-600 text-white hover:bg-red-700";
    } else if (variant === "link") {
      variantStyles = "text-blue-600 underline-offset-4 hover:underline";
    }

    let sizeStyles = "h-10 px-4 py-2 text-sm";
    if (size === "sm") {
      sizeStyles = "h-8 px-3 text-xs";
    } else if (size === "lg") {
      sizeStyles = "h-12 px-6 text-base";
    } else if (size === "icon") {
      sizeStyles = "h-9 w-9 p-0";
    }

    return (
      <button
        ref={ref}
        className={`inline-flex items-center justify-center rounded-xl font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:pointer-events-none disabled:opacity-50 ${variantStyles} ${sizeStyles} ${className}`}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
