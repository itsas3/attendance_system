import type { Metadata } from "next";
import { Suspense } from "react";
import { NavigationProgress } from "./_components/navigation-progress";
import { ThemeInitializer } from "./_components/theme-initializer";
import "./globals.css";

export const metadata: Metadata = {
  title: "Workforce Portal",
  description: "Employee and workforce management portal"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var saved = localStorage.getItem('portal_theme');
                  if (saved) {
                    document.documentElement.setAttribute('data-theme', saved);
                  }
                } catch (e) {}
              })();
            `
          }}
        />
      </head>
      <body>
        <ThemeInitializer />
        <Suspense fallback={null}>
          <NavigationProgress />
        </Suspense>
        {children}
      </body>
    </html>
  );
}
