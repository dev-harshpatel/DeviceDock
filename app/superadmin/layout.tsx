// Bare root layout — login lives here without any auth guard
export default function SuperAdminRootLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
