import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

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
    const classes = buttonVariants({ variant })
    return (
      <button
        className={classes}
        ref={ref}
      />
    ),
  ),
)
Button.displayName = "Button"

export { buttonVariants }
