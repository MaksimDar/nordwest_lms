import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Circle, Clock } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/lib/auth";
import { useCatalog, useMyEnrollments, useRegistration } from "@/lib/catalog";

export const Route = createFileRoute("/_authenticated/portal/program")({
  head: () => ({
    meta: [
      { title: "My program — NordWest LMS" },
      {
        name: "description",
        content: "Your degree curriculum, required and elective courses, and credit progress.",
      },
      { property: "og:title", content: "My program — NordWest LMS" },
      {
        property: "og:description",
        content: "Degree requirements and progress for NordWest students.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Program,
});

const DEGREE_CREDITS = 180;

function Program() {
  const { user, profile } = useCurrentUser();
  const program = profile?.study_course ?? "";
  const catalog = useCatalog();
  const mine = useMyEnrollments(user?.id);
  const { register, drop } = useRegistration(user?.id, profile?.semester_level ?? 1);

  const reqs = useQuery({
    queryKey: ["program", program],
    enabled: !!program,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("program_requirements")
        .select("*")
        .eq("program", program)
        .order("recommended_semester");
      if (error) throw error;
      return data ?? [];
    },
  });

  const byId = new Map((catalog.data ?? []).map((c) => [c.id, c]));
  const enrolled = new Map((mine.data ?? []).map((e) => [e.course_id, e]));
  const rows = (reqs.data ?? []).map((r) => ({ ...r, course: byId.get(r.course_id) }));
  const semesters = Array.from(new Set(rows.map((r) => r.recommended_semester)));
  const current = profile?.semester_level ?? 1;

  const status = (courseId: string, sem: number) => {
    const e = enrolled.get(courseId);
    if (e) return "registered" as const;
    if (sem < current) return "completed" as const;
    return "open" as const;
  };
  const completedCredits = rows
    .filter((r) => status(r.course_id, r.recommended_semester) === "completed")
    .reduce((s, r) => s + (r.course?.credits ?? 0), 0);
  const registeredCredits = rows
    .filter((r) => status(r.course_id, r.recommended_semester) === "registered")
    .reduce((s, r) => s + (r.course?.credits ?? 0), 0);
  const coreLeft = rows.filter(
    (r) => r.category === "core" && status(r.course_id, r.recommended_semester) === "open",
  ).length;

  return (
    <AppShell
      title="My program"
      subtitle={program ? `${program} · you are in semester ${current}` : "No study programme on file"}
      actions={
        <Button asChild>
          <Link to="/portal/register">Open course registration</Link>
        </Button>
      }
    >
      <div className="space-y-6">
        <section className="grid gap-4 sm:grid-cols-3">
          <div className="panel p-5">
            <p className="eyebrow text-muted-foreground">Credits earned</p>
            <p className="mt-2 font-display text-3xl font-bold">
              {completedCredits}
              <span className="text-base font-normal text-muted-foreground"> / {DEGREE_CREDITS} ECTS</span>
            </p>
            <Progress value={(completedCredits / DEGREE_CREDITS) * 100} className="mt-3" />
          </div>
          <div className="panel p-5">
            <p className="eyebrow text-muted-foreground">In progress this semester</p>
            <p className="mt-2 font-display text-3xl font-bold">{registeredCredits} ECTS</p>
          </div>
          <div className="panel p-5">
            <p className="eyebrow text-muted-foreground">Core courses still to take</p>
            <p className="mt-2 font-display text-3xl font-bold">{coreLeft}</p>
          </div>
        </section>

        {semesters.map((sem) => (
          <section key={sem} className="panel p-6">
            <h2 className="font-display text-lg font-bold">
              Semester {sem}
              {sem === current ? <Badge className="ml-2 align-middle">Current</Badge> : null}
            </h2>
            <ul className="mt-3 divide-y divide-border">
              {rows
                .filter((r) => r.recommended_semester === sem)
                .map((r) => {
                  const s = status(r.course_id, sem);
                  const c = r.course;
                  if (!c) return null;
                  return (
                    <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                      <div className="flex items-center gap-3">
                        {s === "completed" ? (
                          <CheckCircle2 className="size-5 text-success" />
                        ) : s === "registered" ? (
                          <Clock className="size-5 text-accent-foreground" />
                        ) : (
                          <Circle className="size-5 text-muted-foreground" />
                        )}
                        <div>
                          <p className="text-sm font-medium">
                            {c.code} · {c.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {c.credits} ECTS · {c.professor_name}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={r.category === "core" ? "default" : "secondary"}>
                          {r.category === "core" ? "Required" : "Elective"}
                        </Badge>
                        {s === "completed" ? (
                          <Badge variant="outline">Completed</Badge>
                        ) : s === "registered" ? (
                          <Button size="sm" variant="outline" onClick={() => drop.mutate(c)}>
                            Drop
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            disabled={c.enrolled >= c.max_seats || register.isPending}
                            onClick={() => register.mutate(c)}
                          >
                            {c.enrolled >= c.max_seats ? "Full" : "Register"}
                          </Button>
                        )}
                      </div>
                    </li>
                  );
                })}
            </ul>
          </section>
        ))}
        {program && rows.length === 0 && !reqs.isLoading ? (
          <div className="panel p-8 text-center text-sm text-muted-foreground">
            No curriculum has been published for your programme yet.
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}
