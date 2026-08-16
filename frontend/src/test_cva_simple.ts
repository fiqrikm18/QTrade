import { cva } from "class-variance-authority"

const test = cva("base", {
  variants: {
    variant: {
      default: "bg-primary",
      destructive: "bg-destructive",
    },
  },
  defaultVariants: {
    variant: "default",
  },
})
