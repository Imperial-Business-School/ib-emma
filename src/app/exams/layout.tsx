import AdminChrome from "../AdminChrome";

export default function ExamsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdminChrome>{children}</AdminChrome>;
}
