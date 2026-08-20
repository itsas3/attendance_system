import type { Metadata } from "next";
import { ThemeInitializer } from "./_components/theme-initializer";
import "./globals.css";

export const metadata: Metadata = {
  title: "Workforce Portal",
  description: "Employee and workforce management portal"
};

const themeScript = `(function(){try{var s=localStorage.getItem('portal_theme');if(s){document.documentElement.setAttribute('data-theme',s);}}catch(e){}})();`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <ThemeInitializer />
        {children}
      </body>
    </html>
  );
}
