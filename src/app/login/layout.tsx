export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <main className="mx-auto max-w-5xl px-6 py-12">{children}</main>;
}
