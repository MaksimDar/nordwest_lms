import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/auth";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — NordWest LMS" },
      {
        name: "description",
        content: "Sign in or create a NordWest LMS account as a lecturer or a student.",
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
          <p className="mt-6 text-xs text-muted-foreground">
            No account? Contact the NordWest IT office — accounts are created by the university.
          </p>
        </div>
      </div>
    </div>
  );
}
