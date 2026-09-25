import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
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
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<"lecturer" | "student">("lecturer");
  const [studentNumber, setStudentNumber] = useState("");
  const [studyCourse, setStudyCourse] = useState("");
  const [semesterLevel, setSemesterLevel] = useState("1");

  useEffect(() => {
    if (ready && session) navigate({ to: role === "student" ? "/portal" : "/dashboard" });
  }, [ready, session, navigate, role]);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Welcome back");
    navigate({ to: "/dashboard" });
  }

  async function signUp(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: {
          full_name: fullName,
          role,
          student_number: role === "student" ? studentNumber : null,
          study_course: studyCourse,
          semester_level: role === "student" ? semesterLevel : null,
        },
      },
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Account created");
    navigate({ to: role === "student" ? "/portal" : "/dashboard" });
  }

  async function google() {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) return toast.error("Google sign-in failed");
    if (result.redirected) return;
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
          <Tabs defaultValue="signin">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Sign in</TabsTrigger>
              <TabsTrigger value="signup">Create account</TabsTrigger>
            </TabsList>

            <TabsContent value="signin" className="mt-6">
              <form onSubmit={signIn} className="space-y-4">
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
            </TabsContent>

            <TabsContent value="signup" className="mt-6">
              <form onSubmit={signUp} className="space-y-4">
                <div>
                  <Label>I am a</Label>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {(["lecturer", "student"] as const).map((r) => (
                      <Button
                        key={r}
                        type="button"
                        variant={role === r ? "default" : "outline"}
                        onClick={() => setRole(r)}
                        className="capitalize"
                      >
                        {r}
                      </Button>
                    ))}
                  </div>
                </div>
                <div>
                  <Label htmlFor="su-name">Full name</Label>
                  <Input
                    id="su-name"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="su-email">University email</Label>
                  <Input
                    id="su-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="su-pw">Password</Label>
                  <Input
                    id="su-pw"
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="su-course">
                    {role === "student" ? "Course of study" : "Department"}
                  </Label>
                  <Input
                    id="su-course"
                    value={studyCourse}
                    onChange={(e) => setStudyCourse(e.target.value)}
                  />
                </div>
                {role === "student" ? (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="su-sid">Student ID</Label>
                      <Input
                        id="su-sid"
                        value={studentNumber}
                        onChange={(e) => setStudentNumber(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="su-sem">Semester</Label>
                      <Input
                        id="su-sem"
                        type="number"
                        min={1}
                        value={semesterLevel}
                        onChange={(e) => setSemesterLevel(e.target.value)}
                      />
                    </div>
                  </div>
                ) : null}
                <Button type="submit" className="w-full" disabled={busy}>
                  Create account
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            or
            <span className="h-px flex-1 bg-border" />
          </div>
          <Button variant="outline" className="w-full" onClick={google}>
            Continue with Google
          </Button>
        </div>
      </div>
    </div>
  );
}
