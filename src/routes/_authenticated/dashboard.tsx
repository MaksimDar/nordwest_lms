import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  BookOpen,
  CalendarPlus,
  ClipboardList,
  PenSquare,
  Plus,
  Users,
  Video,
} from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { AtRiskPanel } from "@/components/AtRiskPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/lib/auth";
import { useMyCourses } from "@/lib/lms";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Lecturer dashboard — NordWest LMS" },
      {
        name: "description",
        content: "Your courses, weekly timetable and quick access to every LMS activity.",
      },
      { property: "og:title", content: "Lecturer dashboard — NordWest LMS" },
      {
        property: "og:description",
        content: "Courses, calendar and quick actions for NordWest lecturers.",
      },
    ],
  }),
  component: Dashboard,
});

const quickAccess = [
  { to: "/meet", label: "Manage students", icon: Users },
  { to: "/teach", label: "Upload material", icon: BookOpen },
  { to: "/test", label: "Create an exam", icon: PenSquare },
  { to: "/grade", label: "Mark & publish", icon: ClipboardList },
] as const;

function startOfWeek() {
  const d = new Date();
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

function Dashboard() {
  const { user, profile, isLecturer } = useCurrentUser();
  const queryClient = useQueryClient();
  const courses = useMyCourses(user?.id);
  const [courseOpen, setCourseOpen] = useState(false);
  const [eventOpen, setEventOpen] = useState(false);

  const weekStart = startOfWeek();
  const weekEnd = new Date(weekStart.getTime() + 7 * 864e5);

  const events = useQuery({
    queryKey: ["events", user?.id, weekStart.toISOString()],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("timetable_events")
        .select("*")
        .eq("lecturer_id", user!.id)
        .gte("starts_at", weekStart.toISOString())
        .lt("starts_at", weekEnd.toISOString())
        .order("starts_at");
      if (error) throw error;
      return data ?? [];
    },
  });

  const counts = useQuery({
    queryKey: ["dash-counts", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const courseIds = (
        (await supabase.from("courses").select("id").eq("lecturer_id", user!.id)).data ?? []
      ).map((c) => c.id);
      if (courseIds.length === 0) return { students: 0, exams: 0, tasks: 0 };
      const [students, exams, tasks] = await Promise.all([
        supabase
          .from("enrollments")
          .select("id", { count: "exact", head: true })
          .in("course_id", courseIds),
        supabase
          .from("exams")
          .select("id", { count: "exact", head: true })
          .in("course_id", courseIds),
        supabase
          .from("tasks")
          .select("id", { count: "exact", head: true })
          .in("course_id", courseIds),
      ]);
      return {
        students: students.count ?? 0,
        exams: exams.count ?? 0,
        tasks: tasks.count ?? 0,
      };
    },
  });

  const createCourse = useMutation({
    mutationFn: async (form: FormData) => {
      const { error } = await supabase.from("courses").insert({
        lecturer_id: user!.id,
        code: String(form.get("code") ?? ""),
        name: String(form.get("name") ?? ""),
        description: String(form.get("description") ?? ""),
        semester: String(form.get("semester") ?? ""),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Course created");
      setCourseOpen(false);
      queryClient.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const createEvent = useMutation({
    mutationFn: async (form: FormData) => {
      const { error } = await supabase.from("timetable_events").insert({
        lecturer_id: user!.id,
        course_id: (form.get("course_id") as string) || null,
        title: String(form.get("title") ?? ""),
        starts_at: new Date(String(form.get("starts_at"))).toISOString(),
        ends_at: form.get("ends_at")
          ? new Date(String(form.get("ends_at"))).toISOString()
          : null,
        meeting_url: (form.get("meeting_url") as string) || null,
        kind: String(form.get("kind") ?? "lecture"),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Added to your calendar");
      setEventOpen(false);
      queryClient.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!isLecturer) {
    return (
      <AppShell title="Student portal" subtitle="This account is registered as a student.">
        <div className="panel p-8 text-center">
          <p className="text-sm text-muted-foreground">
            The lecturer dashboard is only available to lecturer accounts.
          </p>
          <Button asChild className="mt-4">
            <Link to="/portal">Go to my studies</Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      title={`Welcome, ${profile?.full_name || "Lecturer"}`}
      subtitle="Your courses, your week and every activity one click away."
      actions={
        <Dialog open={courseOpen} onOpenChange={setCourseOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-1 size-4" /> New course
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create a course</DialogTitle>
            </DialogHeader>
            <form
              id="course-form"
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                createCourse.mutate(new FormData(e.currentTarget));
              }}
            >
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="code">Course code</Label>
                  <Input id="code" name="code" required placeholder="DLBCSL01" />
                </div>
                <div>
                  <Label htmlFor="semester">Semester</Label>
                  <Input id="semester" name="semester" placeholder="Winter 2026" />
                </div>
              </div>
              <div>
                <Label htmlFor="name">Course name</Label>
                <Input id="name" name="name" required placeholder="Cloud Computing" />
              </div>
              <div>
                <Label htmlFor="description">Short description</Label>
                <Textarea id="description" name="description" rows={3} />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={createCourse.isPending}>
                  Create course
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      }
    >
      <div className="space-y-6">
        <section className="grid gap-4 sm:grid-cols-4">
          {[
            { label: "Courses", value: courses.data?.length ?? 0 },
            { label: "Enrolled students", value: counts.data?.students ?? 0 },
            { label: "Tasks assigned", value: counts.data?.tasks ?? 0 },
            { label: "Examinations", value: counts.data?.exams ?? 0 },
          ].map((stat) => (
            <div key={stat.label} className="panel p-5">
              <p className="eyebrow text-muted-foreground">{stat.label}</p>
              <p className="mt-2 font-display text-3xl font-bold">{stat.value}</p>
            </div>
          ))}
        </section>

        <section>
          <h2 className="mb-3 font-display text-lg font-bold">Quick access</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {quickAccess.map((item) => (
              <Link key={item.to} to={item.to} className="panel flex items-center gap-3 p-4 transition-shadow hover:shadow-[var(--shadow-raised)]">
                <span className="flex size-10 items-center justify-center rounded-md bg-secondary text-secondary-foreground">
                  <item.icon className="size-5" />
                </span>
                <span className="text-sm font-medium">{item.label}</span>
              </Link>
            ))}
          </div>
        </section>

        {user?.id ? <AtRiskPanel lecturerId={user.id} /> : null}

        <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <section className="panel p-6">
            <h2 className="font-display text-lg font-bold">My courses</h2>
            {courses.data?.length ? (
              <ul className="mt-4 divide-y divide-border">
                {courses.data.map((c) => (
                  <li key={c.id} className="flex items-start justify-between gap-4 py-4">
                    <div>
                      <p className="font-medium">
                        {c.code} · {c.name}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {c.semester || "No semester set"}
                      </p>
                      {c.description ? (
                        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                          {c.description}
                        </p>
                      ) : null}
                    </div>
                    <Button asChild size="sm" variant="secondary">
                      <Link to="/teach">Open</Link>
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-sm text-muted-foreground">
                No courses yet. Create your first course to get started.
              </p>
            )}
          </section>

          <section className="panel p-6">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-bold">This week</h2>
              <Dialog open={eventOpen} onOpenChange={setEventOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="secondary">
                    <CalendarPlus className="mr-1 size-4" /> Schedule
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Schedule a class</DialogTitle>
                  </DialogHeader>
                  <form
                    className="space-y-4"
                    onSubmit={(e) => {
                      e.preventDefault();
                      createEvent.mutate(new FormData(e.currentTarget));
                    }}
                  >
                    <div>
                      <Label htmlFor="ev-title">Title</Label>
                      <Input id="ev-title" name="title" required />
                    </div>
                    <div>
                      <Label>Course</Label>
                      <Select name="course_id">
                        <SelectTrigger>
                          <SelectValue placeholder="Select course" />
                        </SelectTrigger>
                        <SelectContent>
                          {(courses.data ?? []).map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.code} · {c.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="ev-start">Starts</Label>
                        <Input id="ev-start" name="starts_at" type="datetime-local" required />
                      </div>
                      <div>
                        <Label htmlFor="ev-end">Ends</Label>
                        <Input id="ev-end" name="ends_at" type="datetime-local" />
                      </div>
                    </div>
                    <div>
                      <Label>Type</Label>
                      <Select name="kind" defaultValue="lecture">
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {["lecture", "tutorial", "exam", "consultation"].map((k) => (
                            <SelectItem key={k} value={k} className="capitalize">
                              {k}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="ev-url">Virtual class link (Teams)</Label>
                      <Input id="ev-url" name="meeting_url" placeholder="https://teams.microsoft.com/..." />
                    </div>
                    <DialogFooter>
                      <Button type="submit" disabled={createEvent.isPending}>
                        Add to calendar
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            {events.data?.length ? (
              <ul className="mt-4 space-y-3">
                {events.data.map((ev) => (
                  <li key={ev.id} className="rounded-md border border-border p-3">
                    <p className="text-sm font-medium">{ev.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(ev.starts_at).toLocaleString(undefined, {
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}{" "}
                      · {ev.kind}
                    </p>
                    {ev.meeting_url ? (
                      <a
                        href={ev.meeting_url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-accent-foreground underline"
                      >
                        <Video className="size-3" /> Join virtual class
                      </a>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-sm text-muted-foreground">
                Nothing scheduled this week yet.
              </p>
            )}
          </section>
        </div>
      </div>
    </AppShell>
  );
}
