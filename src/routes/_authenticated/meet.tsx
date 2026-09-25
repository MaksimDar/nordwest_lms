import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Bell, Plus, UserPlus } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/lib/auth";
import { useMyCourses, useProfilesMap, taskKinds } from "@/lib/lms";

export const Route = createFileRoute("/_authenticated/meet")({
  head: () => ({
    meta: [
      { title: "meetMyStudent — NordWest LMS" },
      {
        name: "description",
        content:
          "Manage students per course, assign assignments, projects and exams, and send reminders.",
      },
      { property: "og:title", content: "meetMyStudent — NordWest LMS" },
      {
        property: "og:description",
        content: "Student overview with course, semester, student ID, attempts and tasks.",
      },
    ],
  }),
  component: MeetMyStudent,
});

function MeetMyStudent() {
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();
  const courses = useMyCourses(user?.id);
  const profiles = useProfilesMap();
  const [courseId, setCourseId] = useState<string>("");
  const [semesterFilter, setSemesterFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [taskOpen, setTaskOpen] = useState(false);
  const [notifyOpen, setNotifyOpen] = useState(false);

  const activeCourse = courses.data?.find((c) => c.id === courseId) ?? courses.data?.[0];
  const activeId = activeCourse?.id;

  const enrollments = useQuery({
    queryKey: ["enrollments", activeId],
    enabled: !!activeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("enrollments")
        .select("*")
        .eq("course_id", activeId!);
      if (error) throw error;
      return data ?? [];
    },
  });

  const tasks = useQuery({
    queryKey: ["tasks", activeId],
    enabled: !!activeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*, task_assignments(id, student_id, status)")
        .eq("course_id", activeId!)
        .order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });

  const rows = useMemo(() => {
    const list = (enrollments.data ?? []).map((e) => {
      const p = profiles.data?.get(e.student_id);
      const hasProject = (tasks.data ?? []).some(
        (t) =>
          t.kind === "project" &&
          (t.task_assignments ?? []).some((a: { student_id: string }) => a.student_id === e.student_id),
      );
      return {
        ...e,
        name: p?.full_name ?? "Unknown student",
        studentNumber: p?.student_number ?? "—",
        studyCourse: p?.study_course ?? "—",
        hasProject,
      };
    });
    return list
      .filter((r) => (semesterFilter === "all" ? true : String(r.semester_level) === semesterFilter))
      .filter((r) =>
        search.trim()
          ? (r.name + r.studentNumber).toLowerCase().includes(search.trim().toLowerCase())
          : true,
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [enrollments.data, profiles.data, tasks.data, semesterFilter, search]);

  const enrol = useMutation({
    mutationFn: async (form: FormData) => {
      const ident = String(form.get("identifier") ?? "").trim();
      const { data: match } = await supabase
        .from("profiles")
        .select("id, semester_level")
        .or(`student_number.eq.${ident},full_name.eq.${ident}`)
        .limit(1)
        .maybeSingle();
      if (!match) throw new Error("No student found with that ID or name");
      const { error } = await supabase.from("enrollments").insert({
        course_id: activeId!,
        student_id: match.id,
        semester_level: match.semester_level ?? 1,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Student enrolled");
      queryClient.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateEnrollment = useMutation({
    mutationFn: async (input: {
      id: string;
      patch: { attempts?: number; coursework_passed?: boolean; semester_level?: number };
    }) => {
      const { error } = await supabase
        .from("enrollments")
        .update(input.patch)
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["enrollments"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const createTask = useMutation({
    mutationFn: async (form: FormData) => {
      const { data: task, error } = await supabase
        .from("tasks")
        .insert({
          course_id: activeId!,
          title: String(form.get("title") ?? ""),
          kind: String(form.get("kind") ?? "assignment"),
          description: String(form.get("description") ?? ""),
          due_date: (form.get("due_date") as string) || null,
        })
        .select()
        .single();
      if (error) throw error;

      const targets = selected.length ? selected : rows.map((r) => r.student_id);
      if (targets.length) {
        const { error: aErr } = await supabase
          .from("task_assignments")
          .insert(targets.map((student_id) => ({ task_id: task.id, student_id })));
        if (aErr) throw aErr;
        await supabase.from("notifications").insert(
          targets.map((student_id) => ({
            recipient_id: student_id,
            sender_id: user!.id,
            title: `New ${task.kind}: ${task.title}`,
            body: task.due_date ? `Due on ${task.due_date}.` : "Please check your portal.",
          })),
        );
      }
    },
    onSuccess: () => {
      toast.success("Task assigned");
      setTaskOpen(false);
      setSelected([]);
      queryClient.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const notify = useMutation({
    mutationFn: async (form: FormData) => {
      const targets = selected.length ? selected : rows.map((r) => r.student_id);
      if (!targets.length) throw new Error("No students selected");
      const { error } = await supabase.from("notifications").insert(
        targets.map((student_id) => ({
          recipient_id: student_id,
          sender_id: user!.id,
          title: String(form.get("title") ?? "Reminder"),
          body: String(form.get("body") ?? ""),
        })),
      );
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Reminder sent");
      setNotifyOpen(false);
      setSelected([]);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const semesters = Array.from(
    new Set((enrollments.data ?? []).map((e) => String(e.semester_level))),
  ).sort();

  return (
    <AppShell
      title="meetMyStudent"
      subtitle="All your students in one place — organise them, assign work and send reminders."
      actions={
        <div className="flex gap-2">
          <Dialog open={notifyOpen} onOpenChange={setNotifyOpen}>
            <DialogTrigger asChild>
              <Button variant="secondary" disabled={!activeId}>
                <Bell className="mr-1 size-4" /> Send reminder
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  Send reminder to {selected.length || rows.length} student(s)
                </DialogTitle>
              </DialogHeader>
              <form
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  notify.mutate(new FormData(e.currentTarget));
                }}
              >
                <div>
                  <Label htmlFor="n-title">Subject</Label>
                  <Input
                    id="n-title"
                    name="title"
                    required
                    defaultValue="Exam registration reminder"
                  />
                </div>
                <div>
                  <Label htmlFor="n-body">Message</Label>
                  <Textarea
                    id="n-body"
                    name="body"
                    rows={4}
                    defaultValue="Please register for your current and carry-over examinations."
                  />
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={notify.isPending}>
                    Send
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog open={taskOpen} onOpenChange={setTaskOpen}>
            <DialogTrigger asChild>
              <Button disabled={!activeId}>
                <Plus className="mr-1 size-4" /> Assign task
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Assign a task</DialogTitle>
              </DialogHeader>
              <form
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  createTask.mutate(new FormData(e.currentTarget));
                }}
              >
                <div>
                  <Label htmlFor="t-title">Title</Label>
                  <Input id="t-title" name="title" required />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Type</Label>
                    <Select name="kind" defaultValue="assignment">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {taskKinds.map((k) => (
                          <SelectItem key={k} value={k} className="capitalize">
                            {k}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="t-due">Due date</Label>
                    <Input id="t-due" name="due_date" type="date" />
                  </div>
                </div>
                <div>
                  <Label htmlFor="t-desc">Description</Label>
                  <Textarea id="t-desc" name="description" rows={3} />
                </div>
                <p className="text-xs text-muted-foreground">
                  {selected.length
                    ? `Will be assigned to ${selected.length} selected student(s).`
                    : "Will be assigned to every student in this course."}
                </p>
                <DialogFooter>
                  <Button type="submit" disabled={createTask.isPending}>
                    Assign
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      }
    >
      <div className="space-y-6">
        <section className="panel flex flex-wrap items-end gap-4 p-5">
          <div className="min-w-56">
            <Label>Course</Label>
            <Select value={activeId ?? ""} onValueChange={setCourseId}>
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
          <div className="w-40">
            <Label>Semester</Label>
            <Select value={semesterFilter} onValueChange={setSemesterFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All semesters</SelectItem>
                {semesters.map((s) => (
                  <SelectItem key={s} value={s}>
                    Semester {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-48 flex-1">
            <Label htmlFor="search">Search by name or student ID</Label>
            <Input id="search" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <form
            className="flex items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              enrol.mutate(new FormData(e.currentTarget));
              e.currentTarget.reset();
            }}
          >
            <div>
              <Label htmlFor="ident">Enrol student (ID or name)</Label>
              <Input id="ident" name="identifier" required placeholder="4244334" />
            </div>
            <Button type="submit" variant="secondary" disabled={!activeId}>
              <UserPlus className="mr-1 size-4" /> Enrol
            </Button>
          </form>
        </section>

        <section className="panel overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10" />
                <TableHead>Student</TableHead>
                <TableHead>Course</TableHead>
                <TableHead>Semester</TableHead>
                <TableHead>Student ID</TableHead>
                <TableHead>Attempts</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>Coursework</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <Checkbox
                      checked={selected.includes(r.student_id)}
                      onCheckedChange={(v) =>
                        setSelected((prev) =>
                          v ? [...prev, r.student_id] : prev.filter((id) => id !== r.student_id),
                        )
                      }
                    />
                  </TableCell>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell>{activeCourse?.name ?? "—"}</TableCell>
                  <TableCell>{r.semester_level}</TableCell>
                  <TableCell>{r.studentNumber}</TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min={0}
                      className="h-8 w-16"
                      defaultValue={r.attempts}
                      onBlur={(e) =>
                        updateEnrollment.mutate({
                          id: r.id,
                          patch: { attempts: Number(e.target.value) },
                        })
                      }
                    />
                  </TableCell>
                  <TableCell>
                    {r.hasProject ? (
                      <Badge>Assigned</Badge>
                    ) : (
                      <span className="text-sm text-muted-foreground">None</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Checkbox
                      checked={r.coursework_passed}
                      onCheckedChange={(v) =>
                        updateEnrollment.mutate({
                          id: r.id,
                          patch: { coursework_passed: !!v },
                        })
                      }
                    />
                  </TableCell>
                </TableRow>
              ))}
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                    {activeId
                      ? "No students match this view. Enrol a student by their student ID."
                      : "Create a course first, then enrol your students."}
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </section>

        <section className="panel p-6">
          <h2 className="font-display text-lg font-bold">Assigned tasks</h2>
          {tasks.data?.length ? (
            <ul className="mt-4 divide-y divide-border">
              {tasks.data.map((t) => (
                <li key={t.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="font-medium">{t.title}</p>
                    <p className="text-sm text-muted-foreground capitalize">
                      {t.kind} · {t.due_date ? `due ${t.due_date}` : "no due date"} ·{" "}
                      {(t.task_assignments ?? []).length} student(s)
                    </p>
                  </div>
                  <Badge variant="secondary" className="capitalize">
                    {t.kind}
                  </Badge>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">No tasks assigned yet.</p>
          )}
        </section>
      </div>
    </AppShell>
  );
}
