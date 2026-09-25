import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, FileText, Video } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { MaterialLink } from "@/components/MaterialLink";
import { StudySummary } from "@/components/StudySummary";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/portal/")({
  head: () => ({
    meta: [
      { title: "My studies — NordWest LMS student portal" },
      {
        name: "description",
        content:
          "Your courses, teaching material, tasks, timetable and available examinations at NordWest University.",
      },
      { property: "og:title", content: "My studies — NordWest LMS" },
      {
        property: "og:description",
        content: "Everything a NordWest student needs: courses, material, tasks and exams.",
      },
    ],
  }),
  component: StudentPortal,
});

function StudentPortal() {
  const { user, profile } = useCurrentUser();

  const data = useQuery({
    queryKey: ["portal", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data: enrolments } = await supabase
        .from("enrollments")
        .select("*, courses(*)")
        .eq("student_id", user!.id);
      const courseIds = (enrolments ?? []).map((e) => e.course_id);
      if (!courseIds.length)
        return { enrolments: enrolments ?? [], materials: [], tasks: [], exams: [], events: [] };
      const [materials, tasks, exams, events] = await Promise.all([
        supabase.from("materials").select("*").in("course_id", courseIds).order("lecture_date"),
        supabase
          .from("task_assignments")
          .select("*, tasks(*)")
          .eq("student_id", user!.id),
        supabase.from("exams").select("*").in("course_id", courseIds).neq("status", "draft"),
        supabase
          .from("timetable_events")
          .select("*")
          .in("course_id", courseIds)
          .gte("starts_at", new Date().toISOString())
          .order("starts_at")
          .limit(6),
      ]);
      return {
        enrolments: enrolments ?? [],
        materials: materials.data ?? [],
        tasks: tasks.data ?? [],
        exams: exams.data ?? [],
        events: events.data ?? [],
      };
    },
  });

  return (
    <AppShell
      title={`Hello, ${profile?.full_name || "student"}`}
      subtitle={
        profile?.student_number
          ? `Student ID ${profile.student_number}${profile.semester_level ? ` · semester ${profile.semester_level}` : ""}`
          : "Your studies at NordWest University"
      }
      actions={
        <Button asChild variant="secondary">
          <Link to="/portal/results">My results</Link>
        </Button>
      }
    >
      <div className="space-y-6">
        <section className="panel p-6">
          <h2 className="font-display text-lg font-bold">My courses</h2>
          {data.data?.enrolments.length ? (
            <ul className="mt-4 grid gap-4 md:grid-cols-2">
              {data.data.enrolments.map((e) => (
                <li key={e.id} className="rounded-lg border border-border p-4">
                  <p className="font-medium">
                    {e.courses?.code} · {e.courses?.name}
                  </p>
                  <p className="text-sm text-muted-foreground">{e.courses?.semester}</p>
                  {e.courses?.description ? (
                    <p className="mt-2 text-sm text-muted-foreground">{e.courses.description}</p>
                  ) : null}
                  <div className="mt-3 flex gap-2">
                    <Badge variant="secondary">Attempts: {e.attempts}</Badge>
                    <Badge variant={e.coursework_passed ? "default" : "destructive"}>
                      {e.coursework_passed ? "Coursework passed" : "Coursework open"}
                    </Badge>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              You are not enrolled in any course yet. Your lecturer enrols you with your student ID.
            </p>
          )}
        </section>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="panel p-6">
            <h2 className="font-display text-lg font-bold">My tasks</h2>
            {data.data?.tasks.length ? (
              <ul className="mt-4 divide-y divide-border">
                {data.data.tasks.map((a) => (
                  <li key={a.id} className="py-3">
                    <p className="font-medium">{a.tasks?.title}</p>
                    <p className="text-sm capitalize text-muted-foreground">
                      {a.tasks?.kind} ·{" "}
                      {a.tasks?.due_date ? `due ${a.tasks.due_date}` : "no due date"} · {a.status}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">No tasks assigned yet.</p>
            )}
          </section>

          <section className="panel p-6">
            <h2 className="font-display text-lg font-bold">Upcoming classes</h2>
            {data.data?.events.length ? (
              <ul className="mt-4 space-y-3">
                {data.data.events.map((ev) => (
                  <li key={ev.id} className="rounded-md border border-border p-3">
                    <p className="text-sm font-medium">{ev.title}</p>
                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                      <CalendarDays className="size-3" />
                      {new Date(ev.starts_at).toLocaleString()}
                    </p>
                    {ev.meeting_url ? (
                      <a
                        href={ev.meeting_url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 inline-flex items-center gap-1 text-xs font-medium underline"
                      >
                        <Video className="size-3" /> Join virtual class
                      </a>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">Nothing scheduled.</p>
            )}
          </section>
        </div>

        <section className="panel p-6">
          <h2 className="font-display text-lg font-bold">Available examinations</h2>
          {data.data?.exams.length ? (
            <ul className="mt-4 divide-y divide-border">
              {data.data.exams.map((x) => (
                <li key={x.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="font-medium">{x.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {x.scheduled_at ? new Date(x.scheduled_at).toLocaleString() : "Open"}
                    </p>
                  </div>
                  <Button asChild size="sm" disabled={x.results_published}>
                    <Link to="/portal/exam/$examId" params={{ examId: x.id }}>
                      {x.results_published ? "Closed" : "Write exam"}
                    </Link>
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              No examination has been released to you yet.
            </p>
          )}
        </section>

        <section className="panel p-6">
          <h2 className="font-display text-lg font-bold">Teaching material</h2>
          {data.data?.materials.length ? (
            <ul className="mt-4 divide-y divide-border">
              {data.data.materials.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-4 py-3">
                  <div className="flex items-start gap-3">
                    <FileText className="mt-1 size-4 text-accent" />
                    <div>
                      <p className="font-medium">{m.title}</p>
                      <p className="text-sm capitalize text-muted-foreground">
                        {m.kind}
                        {m.lecture_date ? ` · ${m.lecture_date}` : ""}
                      </p>
                      <StudySummary
                        materialId={m.id}
                        summary={m.ai_summary}
                        status={m.summary_status}
                      />
                    </div>
                  </div>
                  <MaterialLink url={m.url} filePath={m.file_path} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">No material shared yet.</p>
          )}
        </section>
      </div>
    </AppShell>
  );
}
