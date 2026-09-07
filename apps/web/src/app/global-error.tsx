'use client';

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  return (
    <html>
      <body className="flex min-h-screen items-center justify-center bg-vault font-sans text-text">
        <p>
          Something went wrong.
          {error.digest ? ` (ref: ${error.digest})` : ''}
        </p>
      </body>
    </html>
  );
}
