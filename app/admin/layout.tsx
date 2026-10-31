import { requireAdmin } from "@/lib/auth-guard";
import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/auth";

export const metadata = {
  robots: { index: false, follow: false },
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b">
        <div className="container flex h-16 items-center justify-between">
          <a className="font-heading text-lg" href="/admin">
            Invoice desk
          </a>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/admin/login" });
            }}
          >
            <Button type="submit" variant="outline" size="sm">
              Sign out
            </Button>
          </form>
        </div>
      </header>
      <main className="container flex-1 py-10">{children}</main>
    </div>
  );
}
