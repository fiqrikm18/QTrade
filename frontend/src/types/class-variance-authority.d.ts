declare module 'class-variance-authority' {
  import { clsx } from 'clsx'
  import type { ClassProp, ClassValue, OmitUndefined, StringToBoolean } from './types'
  export type VariantProps<Component extends (...args: any) => any> = Omit<OmitUndefined<Parameters<Component>[0]>, 'class' | 'className'>
  export type CxOptions = Parameters<typeof clsx>
  export type CxReturn = ReturnType<typeof clsx>
  export type CxReturn = ReturnType<typeof clsx>
  export declare const cva: <T>(base?: ClassValue, config?: Config<T>) => (props?: Props<T>) => string
  export {}
}
