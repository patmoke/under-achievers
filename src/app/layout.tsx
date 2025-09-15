// src/app/layout.tsx
import './globals.css';

export const metadata = {
  title: 'Under Achievers',
  description: 'Guess the NFL spreads'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-900 min-h-screen">
        <header className="max-w-4xl mx-auto p-4">
          <h1 className="text-xl font-bold">Under Achievers</h1>
        </header>
        <main className="max-w-4xl mx-auto p-4">{children}</main>
      </body>
    </html>
  );
}
