// app/layout.tsx
import { SessionGuard } from "@/app/components/SessionGuard";

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <SessionGuard>
          {children}
        </SessionGuard>
      </body>
    </html>
  );
}