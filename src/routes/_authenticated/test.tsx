import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Send, Trash2 } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
import {
  isAutoMarkable,
  questionKindLabel,
  questionKinds,
  useMyCourses,
  useProfilesMap,
} from "@/lib/lms";

export const Route = createFileRoute("/_authenticated/test")({
  head: () => ({
    meta: [
      { title: "testMyStudent — NordWest LMS" },
      {
        name: "description",
        content:
          "Create multiple choice, yes/no, essay and mathematical exam questions, then release the exam.",
      },
      { property: "og:title", content: "testMyStudent — NordWest LMS" },
      {
        property: "og:description",
        content: "Build examinations, set marks and filter eligible students.",
      },
    ],
  }),
  component: TestMyStudent,
});

function TestMyStudent() {
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();
  const courses = useMyCourses(user?.id);
  const profiles = useProfilesMap();
  const [courseId, setCourseId] = useState("");
  const [examId, setExamId] = useState("");
  const [examOpen, setExamOpen] = useState(false);
  const [qOpen, setQOpen] = useState(false);
  const [qKind, setQKind] = useState<string>("multiple_choice");
  const [maxAttempts, setMaxAttempts] = useState("all");

  const activeCourse = courses.data?.find((c) => c.id === courseId) ?? courses.data?.[0];
  const activeCourseId = activeCourse?.id;

  const exams = useQuery({
    queryKey: ["exams", activeCourseId],
    enabled: !!activeCourseId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exams")
        .select("*")
        .eq("course_id", activeCourseId!)
        .order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });

  const activeExam = exams.data?.find((x) => x.id === examId) ?? exams.data?.[0];

  const questions = useQuery({
    queryKey: ["questions", activeExam?.id],
    enabled: !!activeExam?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exam_questions")
        .select("*")
        .eq("exam_id", activeExam!.id)
        .order("position");
      if (error) throw error;
      return data ?? [];
    },
  });

  const enrollments = useQuery({
    queryKey: ["enrollments", activeCourseId],
    enabled: !!activeCourseId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("enrollments")
        .select("*")
        .eq("course_id", activeCourseId!);
      if (error) throw error;
      return data ?? [];
    },
  });

  const eligible = useMemo(
    () =>
      (enrollments.data ?? [])
        .map((e) => ({ ...e, profile: profiles.data?.get(e.student_id) }))
        .filter((e) =>
          maxAttempts === "all" ? true : e.attempts <= Number(maxAttempts),
        ),
    [enrollments.data, profiles.data, maxAttempts],
  );

  const createExam = useMutation({
    mutationFn: async (form: FormData) => {
      const { error } = await supabase.from("exams").insert({
        course_id: activeCourseId!,
        title: String(form.get("title") ?? ""),
        scheduled_at: form.get("scheduled_at")
          ? new Date(String(form.get("scheduled_at"))).toISOString()
          : null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Exam created as draft");
      setExamOpen(false);
      queryClient.invalidateQueries({ queryKey: ["exams"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addQuestion = useMutation({
    mutationFn: async (form: FormData) => {
      const options = String(form.get("options") ?? "")
        .split("\n")
        .map((o) => o.trim())
        .filter(Boolean);
      const { error } = await supabase.from("exam_questions").insert({
        exam_id: activeExam!.id,
        position: (questions.data?.length ?? 0) + 1,
        kind: qKind,
        prompt: String(form.get("prompt") ?? ""),
        marks: Number(form.get("marks") ?? 1),
        options,
        correct_answer: (form.get("correct_answer") as string) || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Question added");
      setQOpen(false);
      queryClient.invalidateQueries({ queryKey: ["questions"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteQuestion = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("exam_questions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["questions"] }),
  });

  const release = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("exams")
        .update({ status: "released" })
        .eq("id", activeExam!.id);
      if (error) throw error;
      const targets = eligible
        .filter((e) => e.coursework_passed)
        .map((e) => e.student_id);
      if (targets.length) {
        await supabase.from("notifications").insert(
          targets.map((student_id) => ({
            recipient_id: student_id,
            sender_id: user!.id,
            title: `Exam released: ${activeExam!.title}`,
            body: "The examination is now available in your student portal.",
          })),
        );
      }
    },
    onSuccess: () => {
      toast.success("Exam released to eligible students");
      queryClient.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const totalMarks = (questions.data ?? []).reduce((sum, q) => sum + Number(q.marks), 0);

  return (
    <AppShell
      title="testMyStudent"
      subtitle="Build your examination question by question, then release it to eligible students."
      actions={
        <div className="flex items-center gap-2">
          <Select value={activeCourseId ?? ""} onValueChange={setCourseId}>
            <SelectTrigger className="w-52">
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
          <Dialog open={examOpen} onOpenChange={setExamOpen}>
            <DialogTrigger asChild>
              <Button disabled={!activeCourseId}>
                <Plus className="mr-1 size-4" /> New exam
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create an examination</DialogTitle>
              </DialogHeader>
              <form
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  createExam.mutate(new FormData(e.currentTarget));
                }}
              >
                <div>
                  <Label htmlFor="x-title">Title</Label>
                  <Input id="x-title" name="title" required placeholder="Final examination" />
                </div>
                <div>
                  <Label htmlFor="x-date">Scheduled for</Label>
                  <Input id="x-date" name="scheduled_at" type="datetime-local" />
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={createExam.isPending}>
                    Create draft
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      }
    >
      <div className="space-y-6">
        <section className="panel p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-bold">Examinations</h2>
              <p className="text-sm text-muted-foreground">
                {activeCourse ? `${activeCourse.code} · ${activeCourse.name}` : "No course selected"}
              </p>
            </div>
            {exams.data?.length ? (
              <Select value={activeExam?.id ?? ""} onValueChange={setExamId}>
                <SelectTrigger className="w-64">
                  <SelectValue placeholder="Select exam" />
                </SelectTrigger>
                <SelectContent>
                  {exams.data.map((x) => (
                    <SelectItem key={x.id} value={x.id}>
                      {x.title} ({x.status})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
          </div>
        </section>

        {activeExam ? (
          <>
            <section className="panel p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-display text-lg font-bold">{activeExam.title}</h3>
                  <p className="text-sm text-muted-foreground">
                    {questions.data?.length ?? 0} question(s) · {totalMarks} marks in total ·{" "}
                    <span className="capitalize">{activeExam.status}</span>
                  </p>
                </div>
                <div className="flex gap-2">
                  <Dialog open={qOpen} onOpenChange={setQOpen}>
                    <DialogTrigger asChild>
                      <Button variant="secondary">
                        <Plus className="mr-1 size-4" /> Add question
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Add an examination question</DialogTitle>
                      </DialogHeader>
                      <form
                        className="space-y-4"
                        onSubmit={(e) => {
                          e.preventDefault();
                          addQuestion.mutate(new FormData(e.currentTarget));
                        }}
                      >
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label>Classification</Label>
                            <Select value={qKind} onValueChange={setQKind}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {questionKinds.map((k) => (
                                  <SelectItem key={k} value={k}>
                                    {questionKindLabel(k)}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label htmlFor="q-marks">Marks</Label>
                            <Input
                              id="q-marks"
                              name="marks"
                              type="number"
                              min={0.5}
                              step={0.5}
                              defaultValue={1}
                            />
                          </div>
                        </div>
                        <div>
                          <Label htmlFor="q-prompt">Question</Label>
                          <Textarea id="q-prompt" name="prompt" rows={3} required />
                        </div>
                        {qKind === "multiple_choice" ? (
                          <div>
                            <Label htmlFor="q-options">Answer options (one per line)</Label>
                            <Textarea id="q-options" name="options" rows={4} />
                          </div>
                        ) : null}
                        {isAutoMarkable(qKind) ? (
                          <div>
                            <Label htmlFor="q-correct">
                              Correct answer (enables automatic marking)
                            </Label>
                            <Input
                              id="q-correct"
                              name="correct_answer"
                              placeholder={qKind === "yes_no" ? "yes or no" : "exact option text"}
                            />
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground">
                            Essay and mathematical answers are marked in gradeMyStudent, where
                            assisted scoring suggests marks based on your weighting.
                          </p>
                        )}
                        <DialogFooter>
                          <Button type="submit" disabled={addQuestion.isPending}>
                            Add question
                          </Button>
                        </DialogFooter>
                      </form>
                    </DialogContent>
                  </Dialog>
                  <Button
                    onClick={() => release.mutate()}
                    disabled={activeExam.status !== "draft" || !questions.data?.length}
                  >
                    <Send className="mr-1 size-4" />
                    {activeExam.status === "draft" ? "Release exam" : "Released"}
                  </Button>
                </div>
              </div>

              <ul className="mt-5 space-y-3">
                {(questions.data ?? []).map((q, i) => (
                  <li key={q.id} className="rounded-lg border border-border p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-medium">
                          {i + 1}. {q.prompt}
                        </p>
                        {Array.isArray(q.options) && q.options.length ? (
                          <ul className="mt-2 list-inside list-disc text-sm text-muted-foreground">
                            {(q.options as string[]).map((o) => (
                              <li key={o}>{o}</li>
                            ))}
                          </ul>
                        ) : null}
                        {q.correct_answer ? (
                          <p className="mt-2 text-xs text-muted-foreground">
                            Correct answer: {q.correct_answer} · automatic marking on
                          </p>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">{questionKindLabel(q.kind)}</Badge>
                        <Badge>{q.marks} marks</Badge>
                        <Button size="sm" variant="ghost" onClick={() => deleteQuestion.mutate(q.id)}>
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </div>
                  </li>
                ))}
                {questions.data?.length === 0 ? (
                  <li className="text-sm text-muted-foreground">
                    No questions yet. Add your first question above.
                  </li>
                ) : null}
              </ul>
            </section>

            <section className="panel p-6">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <h3 className="font-display text-lg font-bold">Eligible students</h3>
                  <p className="text-sm text-muted-foreground">
                    Students must pass all coursework of their Blended Learning to sit the exam.
                  </p>
                </div>
                <div className="w-48">
                  <Label>Maximum attempts</Label>
                  <Select value={maxAttempts} onValueChange={setMaxAttempts}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Any number</SelectItem>
                      {["0", "1", "2"].map((n) => (
                        <SelectItem key={n} value={n}>
                          {n} or fewer
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Table className="mt-4">
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Student ID</TableHead>
                    <TableHead>Semester</TableHead>
                    <TableHead>Attempts</TableHead>
                    <TableHead>Eligible</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {eligible.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="font-medium">
                        {e.profile?.full_name ?? "Unknown"}
                      </TableCell>
                      <TableCell>{e.profile?.student_number ?? "—"}</TableCell>
                      <TableCell>{e.semester_level}</TableCell>
                      <TableCell>{e.attempts}</TableCell>
                      <TableCell>
                        {e.coursework_passed ? (
                          <Badge>Yes</Badge>
                        ) : (
                          <Badge variant="destructive">Coursework open</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {eligible.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                        No students match this filter.
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </section>
          </>
        ) : (
          <div className="panel p-8 text-center text-sm text-muted-foreground">
            Create an examination for this course to start adding questions.
          </div>
        )}
      </div>
    </AppShell>
  );
}
