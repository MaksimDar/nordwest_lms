import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/portal/results")({
  head: () => ({
    meta: [
      { title: "My results — NordWest LMS student portal" },
      {
        name: "description",
        content: "View your published examination results at NordWest University.",
      },
      { property: "og:title", content: "My results — NordWest LMS" },
      {
        property: "og:description",
        content: "Published examination marks for NordWest students.",
      },
    ],
  }),
  component: Results,
});

function Results() {
  const { user } = useCurrentUser();

  const results = useQuery({
    queryKey: ["results", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exam_attempts")
        .select("*, exams(title, results_published, course_id, courses(code, name))")
        .eq("student_id", user!.id);
      if (error) throw error;
      return data ?? [];
    },
  });

  const published = (results.data ?? []).filter(
    (r) => r.graded && r.exams?.results_published,
  );
  const pending = (results.data ?? []).filter(
    (r) => !(r.graded && r.exams?.results_published),
  );

  return (
    <AppShell title="My results" subtitle="Results appear here as soon as your lecturer publishes them.">
      <div className="space-y-6">
        <section className="panel p-6">
          <h2 className="font-display text-lg font-bold">Published results</h2>
          {published.length ? (
            <ul className="mt-4 space-y-4">
              {published.map((r) => {
                const pct = r.max_score
                  ? Math.round((Number(r.score ?? 0) / Number(r.max_score)) * 100)
                  : 0;
                return (
                  <li key={r.id} className="rounded-lg border border-border p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{r.exams?.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {r.exams?.courses?.code} · {r.exams?.courses?.name}
                        </p>
                      </div>
                      <Badge>
                        {r.score} / {r.max_score}
                      </Badge>
                    </div>
                    <Progress value={pct} className="mt-3" />
                    <p className="mt-2 text-xs text-muted-foreground">
                      {pct}% · {pct >= 50 ? "Passed" : "Not passed"}
                    </p>
                    {r.feedback ? <p className="mt-2 text-sm">{r.feedback}</p> : null}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">No published results yet.</p>
          )}
        </section>

        <section className="panel p-6">
          <h2 className="font-display text-lg font-bold">Awaiting marking</h2>
          {pending.length ? (
            <ul className="mt-4 divide-y divide-border">
              {pending.map((r) => (
                <li key={r.id} className="flex items-center justify-between py-3">
                  <p className="font-medium">{r.exams?.title}</p>
                  <Badge variant="secondary">
                    {r.submitted_at ? "Submitted" : "In progress"}
                  </Badge>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">Nothing awaiting marking.</p>
          )}
        </section>
      </div>
    </AppShell>
  );
}
