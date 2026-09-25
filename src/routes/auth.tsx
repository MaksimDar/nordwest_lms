import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/auth";
import { demoAccounts, signInAsDemo } from "@/lib/demo";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — NordWest LMS" },
      {
        name: "description",
        content: "Sign in to NordWest LMS with the university email and password you were given.",
      },
      { property: "og:title", content: "Sign in — NordWest LMS" },
      {
        property: "og:description",
        content: "Access your NordWest University courses, exams and results.",
      },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { session, ready } = useSession();
  const [busy, setBusy] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (ready && session) navigate({ to: "/dashboard" });
  }, [ready, session, navigate]);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Welcome back");
    navigate({ to: "/dashboard" });
  }

  return (
    <div className="flex min-h-screen">
      <div className="hero-surface hidden flex-1 flex-col justify-between p-10 lg:flex">
        <Link to="/" className="flex items-center gap-3">
          <span className="gold-surface flex size-9 items-center justify-center rounded-md font-display font-bold">
            N
          </span>
          <span className="font-display text-lg font-bold">NordWest LMS</span>
        </Link>
        <div>
          <h2 className="max-w-md font-display text-3xl font-bold">
            Meet, teach, test and grade your students in one place.
          </h2>
          <p className="mt-4 max-w-md text-sm text-primary-foreground/80">
            Lecturers manage courses, materials, examinations and results. Students follow their
            studies and receive their grades in the student portal.
          </p>
        </div>
        <p className="text-xs text-primary-foreground/60">NordWest University · Digital campus</p>
      </div>

      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <h1 className="font-display text-2xl font-bold">Sign in</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Use the university account provided by NordWest administration.
          </p>
          <form onSubmit={signIn} className="mt-6 space-y-4">
            <div>
              <Label htmlFor="si-email">University email</Label>
              <Input
                id="si-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="si-pw">Password</Label>
              <Input
                id="si-pw"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              Sign in
            </Button>
          </form>
          <div className="mt-8 rounded-lg border border-border bg-secondary/50 p-4">
            <p className="eyebrow text-muted-foreground">Live demo · one-click sign in</p>
            <div className="mt-3 grid gap-2">
              {demoAccounts.map((a) => (
                <button
                  key={a.key}
                  type="button"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await signInAsDemo(a.key);
                    } catch (err) {
                      toast.error((err as Error).message);
                      setBusy(false);
                    }
                  }}
                  className="flex items-center gap-3 rounded-md border border-border bg-card p-3 text-left transition-colors hover:border-primary disabled:opacity-60"
                >
                  <span className="gold-surface flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-bold">
                    {a.key === "anna" ? "AM" : "MS"}
                  </span>
                  <span>
                    <span className="block text-sm font-medium">{a.name}</span>
                    <span className="block text-xs text-muted-foreground">{a.role}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
          <p className="mt-6 text-xs text-muted-foreground">
            No account? Contact the NordWest IT office — accounts are created by the university.
          </p>
        </div>
      </div>
    </div>
  );
}
