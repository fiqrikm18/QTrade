import type { Metadata } from "next"
import "./globals.css"
import { AppShell } from "@/components/ui/appshell"

export const metadata: Metadata = {
  title: "IHSG Quant",
  description: "IHSG Quantitative Analytics & Decision Intelligence Platform",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="h-full bg-background text-foreground">
        <div className="h-full">
          <AppShell>{children}</AppShell>
        </div>
      </body>
    </html>
  )
}
