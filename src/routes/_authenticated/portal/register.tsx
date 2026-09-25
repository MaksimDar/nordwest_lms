import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCurrentUser } from "@/lib/auth";
import { useCatalog, useMyEnrollments, useRegistration } from "@/lib/catalog";

export const Route = createFileRoute("/_authenticated/portal/register")({
  head: () => ({
    meta: [
      { title: "Course registration — NordWest LMS" },
      {
        name: "description",
        content: "Browse open NordWest courses, see free seats and register or drop courses instantly.",
      },
      { property: "og:title", content: "Course registration — NordWest LMS" },
      {
        property: "og:description",
        content: "Live course catalogue with seat availability for NordWest students.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Registration,
});

function Registration() {
  const { user, profile } = useCurrentUser();
  const catalog = useCatalog();
  const mine = useMyEnrollments(user?.id);
  const { register, drop } = useRegistration(user?.id, profile?.semester_level ?? 1);
  const [search, setSearch] = useState("");
  const [discipline, setDiscipline] = useState("all");

  const myIds = new Set((mine.data ?? []).map((e) => e.course_id));
  const courses = catalog.data ?? [];
  const disciplines = useMemo(
    () => Array.from(new Set(courses.map((c) => c.discipline))).sort(),
    [courses],
  );
  const filtered = courses.filter(
    (c) =>
      (discipline === "all" || c.discipline === discipline) &&
      `${c.code} ${c.name} ${c.professor_name}`.toLowerCase().includes(search.toLowerCase()),
  );
  const myCourses = courses.filter((c) => myIds.has(c.id));
  const credits = myCourses.reduce((s, c) => s + c.credits, 0);
  const pending = register.isPending || drop.isPending;

  return (
    <AppShell
      title="Course registration"
      subtitle="Winter 2026/27 · pick your courses. Changes are saved straight away."
    >
      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <section className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Input
              placeholder="Search by code, title or professor"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-xs"
            />
            <Select value={discipline} onValueChange={setDiscipline}>
              <SelectTrigger className="w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All disciplines</SelectItem>
                {disciplines.map((d) => (
                  <SelectItem key={d} value={d}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="self-center text-sm text-muted-foreground">
              {filtered.length} of {courses.length} courses
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {filtered.map((c) => {
              const registered = myIds.has(c.id);
              const free = Math.max(c.max_seats - c.enrolled, 0);
              const full = free === 0;
              return (
                <article key={c.id} className="panel flex flex-col p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="eyebrow text-muted-foreground">
                        {c.code} · {c.discipline}
                      </p>
                      <h3 className="mt-1 font-display text-base font-bold">{c.name}</h3>
                      <p className="text-xs text-muted-foreground">{c.professor_name}</p>
                    </div>
                    <Badge variant="secondary">{c.credits} ECTS</Badge>
                  </div>
                  <p className="mt-2 line-clamp-2 flex-1 text-sm text-muted-foreground">
                    {c.description}
                  </p>
                  <div className="mt-3">
                    <div className="flex justify-between text-xs">
                      <span className={full ? "font-semibold text-destructive" : "text-muted-foreground"}>
                        {full ? "Course full" : `${free} of ${c.max_seats} seats free`}
                      </span>
                      <span className="text-muted-foreground">{c.enrolled} registered</span>
                    </div>
                    <Progress value={(c.enrolled / c.max_seats) * 100} className="mt-1 h-1.5" />
                  </div>
                  <div className="mt-4 flex justify-end">
                    {registered ? (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={pending}
                        onClick={() => drop.mutate(c)}
                      >
                        Drop
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        disabled={pending || full}
                        onClick={() => register.mutate(c)}
                      >
                        {full ? "Full" : "Register"}
                      </Button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <aside className="panel h-fit p-5 xl:sticky xl:top-6">
          <h2 className="font-display text-lg font-bold">My schedule</h2>
          <p className="text-sm text-muted-foreground">
            {myCourses.length} courses · {credits} ECTS
          </p>
          <Progress value={Math.min((credits / 30) * 100, 100)} className="mt-3" />
          <p className="mt-1 text-xs text-muted-foreground">Recommended load: 30 ECTS per semester</p>
          <ul className="mt-4 divide-y divide-border">
            {myCourses.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-2 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {c.code} · {c.name}
                  </p>
                  <p className="text-xs text-muted-foreground">{c.credits} ECTS</p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={pending}
                  onClick={() => drop.mutate(c)}
                >
                  Drop
                </Button>
              </li>
            ))}
            {myCourses.length === 0 ? (
              <li className="py-3 text-sm text-muted-foreground">No courses yet.</li>
            ) : null}
          </ul>
        </aside>
      </div>
    </AppShell>
  );
}
