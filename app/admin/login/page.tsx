import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { signIn } from "@/lib/auth";
import { getAdminSession } from "@/lib/auth-guard";

export const metadata = {
  title: "Admin Login",
  robots: { index: false, follow: false },
};

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (await getAdminSession()) {
    redirect("/invoices");
  }

  const { error } = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-6 rounded-lg border bg-card p-8">
        <div className="space-y-2 text-center">
          <h1 className="font-heading text-2xl">Admin</h1>
          <p className="text-sm text-muted-foreground">
            Restricted to a single account.
          </p>
        </div>

        {error ? (
          <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            That account is not authorised.
          </p>
        ) : null}

        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/invoices" });
          }}
        >
          <Button type="submit" className="w-full">
            Continue with Google
          </Button>
        </form>
      </div>
    </div>
  );
}
