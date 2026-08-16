import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva("base", {
  variants: {
    variant: {
      default: "bg-primary",
    },
  },
  defaultVariants: {
    variant: "default",
  },
})

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant }), className)}
        ref={ref}
      />
    ),
  ),
)
Button.displayName = "Button"

export { buttonVariants }
