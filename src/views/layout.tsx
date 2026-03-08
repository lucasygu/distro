import type { Child } from "hono/jsx";

export function Layout({
  title,
  children,
}: {
  title: string;
  children: Child;
}) {
  return (
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>{title}</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <script src="https://cdn.jsdelivr.net/npm/chart.js@4"></script>
        <style>{`
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
          .event-row:nth-child(odd) { background: rgba(0,0,0,0.02); }
        `}</style>
      </head>
      <body class="bg-gray-50 text-gray-900 min-h-screen">{children}</body>
    </html>
  );
}
