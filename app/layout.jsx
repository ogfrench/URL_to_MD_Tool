import "./globals.css";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";

export const metadata = {
  title: "URL → Doc",
  description: "Save webpages as a single PDF or Markdown document.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <TooltipProvider delayDuration={150}>{children}</TooltipProvider>
        <Toaster closeButton position="bottom-center" toastOptions={{ duration: 3500 }} />
      </body>
    </html>
  );
}
