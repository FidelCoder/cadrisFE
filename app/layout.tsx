import type { Metadata, Viewport } from "next";
import "@/app/globals.css";
import { AppShell } from "@/components/layout/app-shell";
import { Providers } from "@/app/providers";

export const metadata: Metadata = {
  title: "Cadris",
  description: "Real-time AI camera direction from one phone",
  applicationName: "Cadris",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Cadris"
  },
  formatDetection: {
    email: false,
    address: false,
    telephone: false
  }
};

export const viewport: Viewport = {
  themeColor: "#050816",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  userScalable: false
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
