import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Megaphone, Sparkles } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { draftExamFeedback } from "@/lib/ai.functions";
import { useCurrentUser } from "@/lib/auth";
import { isAutoMarkable, questionKindLabel, useMyCourses, useProfilesMap } from "@/lib/lms";

function FeedbackEditor({
  attemptId,
  initial,
  published,
}: {
  attemptId: string;
  initial: string;
  published: boolean;
}) {
  const qc = useQueryClient();
  const [text, setText] = useState(initial);
  const draft = useServerFn(draftExamFeedback);
  const generate = useMutation({
    mutationFn: () => draft({ data: { attemptId } }),
    onSuccess: (res) => {
      setText((res as { feedback?: string })?.feedback ?? text);
      toast.success("AI draft ready — review and edit before releasing");
      qc.invalidateQueries({ queryKey: ["attempts"] });
    },
    onError: (e: Error) => toast.error(e.message || "Draft could not be created"),
  });
  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("exam_attempts")
        .update({ feedback: text })
        .eq("id", attemptId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Feedback saved");
      qc.invalidateQueries({ queryKey: ["attempts"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mt-4 rounded-lg border border-dashed border-border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label className="text-sm font-medium">Feedback for the student</Label>
        <Button
          size="sm"
          variant="secondary"
          disabled={generate.isPending}
          onClick={() => generate.mutate()}
        >
          <Sparkles className={`mr-1 size-4 ${generate.isPending ? "animate-pulse" : ""}`} />
          {generate.isPending ? "Writing draft…" : text ? "Redraft with AI" : "Draft feedback with AI"}
        </Button>
      </div>
      <Textarea
        rows={5}
        className="mt-2"
        value={text}
        placeholder="Write feedback, or let the AI draft it from the marked answers."
        onChange={(e) => setText(e.target.value)}
      />
      <div className="mt-2 flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {published
            ? "Results are published — students see saved feedback."
            : "Students see this only after you publish results."}
        </p>
        <Button size="sm" disabled={save.isPending || text === initial} onClick={() => save.mutate()}>
          Save feedback
        </Button>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/_authenticated/grade")({
  head: () => ({
    meta: [
      { title: "gradeMyStudent — NordWest LMS" },
      {
        name: "description",
        content:
          "Mark submitted examinations, apply automatic marking and publish results to students.",
      },
      { property: "og:title", content: "gradeMyStudent — NordWest LMS" },
      {
        property: "og:description",
        content: "Marking and result publication for NordWest examinations.",
      },
    ],
  }),
  component: GradeMyStudent,
});

function GradeMyStudent() {
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();
  const courses = useMyCourses(user?.id);
  const profiles = useProfilesMap();
  const [courseId, setCourseId] = useState("");
  const [examId, setExamId] = useState("");
  const [openAttempt, setOpenAttempt] = useState<string | null>(null);

  const activeCourseId = (courses.data?.find((c) => c.id === courseId) ?? courses.data?.[0])?.id;

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

  const attempts = useQuery({
    queryKey: ["attempts", activeExam?.id],
    enabled: !!activeExam?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exam_attempts")
        .select("*, exam_answers(*)")
        .eq("exam_id", activeExam!.id)
        .not("submitted_at", "is", null);
      if (error) throw error;
      return data ?? [];
    },
  });

  const totalMarks = (questions.data ?? []).reduce((s, q) => s + Number(q.marks), 0);

  const autoMark = useMutation({
    mutationFn: async () => {
      const qMap = new Map((questions.data ?? []).map((q) => [q.id, q]));
      for (const attempt of attempts.data ?? []) {
        for (const ans of attempt.exam_answers ?? []) {
          const q = qMap.get(ans.question_id);
          if (!q || !isAutoMarkable(q.kind) || !q.correct_answer) continue;
          const correct =
            ans.response.trim().toLowerCase() === q.correct_answer.trim().toLowerCase();
          await supabase
            .from("exam_answers")
            .update({ awarded_marks: correct ? Number(q.marks) : 0, auto_marked: true })
            .eq("id", ans.id);
        }
      }
    },
    onSuccess: () => {
      toast.success("Automatic marking applied");
      queryClient.invalidateQueries({ queryKey: ["attempts"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveMark = useMutation({
    mutationFn: async (input: { answerId: string; marks: number }) => {
      const { error } = await supabase
        .from("exam_answers")
        .update({ awarded_marks: input.marks, auto_marked: false })
        .eq("id", input.answerId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["attempts"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const finalise = useMutation({
    mutationFn: async (attemptId: string) => {
      const attempt = (attempts.data ?? []).find((a) => a.id === attemptId);
      if (!attempt) throw new Error("Attempt not found");
      const score = (attempt.exam_answers ?? []).reduce(
        (s: number, a: { awarded_marks: number | null }) => s + Number(a.awarded_marks ?? 0),
        0,
      );
      const { error } = await supabase
        .from("exam_attempts")
        .update({ score, max_score: totalMarks, graded: true })
        .eq("id", attemptId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Marking finalised");
      queryClient.invalidateQueries({ queryKey: ["attempts"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const publish = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("exams")
        .update({ results_published: true, status: "graded" })
        .eq("id", activeExam!.id);
      if (error) throw error;
      const graded = (attempts.data ?? []).filter((a) => a.graded);
      if (graded.length) {
        await supabase.from("notifications").insert(
          graded.map((a) => ({
            recipient_id: a.student_id,
            sender_id: user!.id,
            title: `Results published: ${activeExam!.title}`,
            body: "Your result is now available in the student portal.",
          })),
        );
      }
    },
    onSuccess: () => {
      toast.success("Results published — students have been alerted");
      queryClient.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppShell
      title="gradeMyStudent"
      subtitle="Mark the examinations your students have written, then publish their results."
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
          {exams.data?.length ? (
            <Select value={activeExam?.id ?? ""} onValueChange={setExamId}>
              <SelectTrigger className="w-56">
                <SelectValue placeholder="Select exam" />
              </SelectTrigger>
              <SelectContent>
                {exams.data.map((x) => (
                  <SelectItem key={x.id} value={x.id}>
                    {x.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
        </div>
      }
    >
      {activeExam ? (
        <div className="space-y-6">
          <section className="panel flex flex-wrap items-center justify-between gap-4 p-6">
            <div>
              <h2 className="font-display text-lg font-bold">{activeExam.title}</h2>
              <p className="text-sm text-muted-foreground">
                {attempts.data?.length ?? 0} submission(s) · {totalMarks} marks total ·{" "}
                {activeExam.results_published ? "results published" : "results not published"}
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => autoMark.mutate()}>
                <Sparkles className="mr-1 size-4" /> Apply automatic marking
              </Button>
              <Button
                onClick={() => publish.mutate()}
                disabled={activeExam.results_published || !attempts.data?.some((a) => a.graded)}
              >
                <Megaphone className="mr-1 size-4" /> Publish results
              </Button>
            </div>
          </section>

          {(attempts.data ?? []).map((attempt) => {
            const profile = profiles.data?.get(attempt.student_id);
            const expanded = openAttempt === attempt.id;
            return (
              <section key={attempt.id} className="panel p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">{profile?.full_name ?? "Unknown student"}</p>
                    <p className="text-sm text-muted-foreground">
                      {profile?.student_number ?? "—"} · submitted{" "}
                      {attempt.submitted_at
                        ? new Date(attempt.submitted_at).toLocaleString()
                        : "—"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {attempt.graded ? (
                      <Badge>
                        {attempt.score} / {attempt.max_score ?? totalMarks}
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Not marked</Badge>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setOpenAttempt(expanded ? null : attempt.id)}
                    >
                      {expanded ? "Hide answers" : "Open answers"}
                    </Button>
                    <Button size="sm" onClick={() => finalise.mutate(attempt.id)}>
                      <CheckCircle2 className="mr-1 size-4" /> Finalise
                    </Button>
                  </div>
                </div>

                {expanded ? (
                  <ul className="mt-4 space-y-4">
                    {(questions.data ?? []).map((q, i) => {
                      const ans = (attempt.exam_answers ?? []).find(
                        (a: { question_id: string }) => a.question_id === q.id,
                      );
                      return (
                        <li key={q.id} className="rounded-lg border border-border p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium">
                                {i + 1}. {q.prompt}
                              </p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {questionKindLabel(q.kind)} · {q.marks} marks
                                {q.correct_answer ? ` · correct: ${q.correct_answer}` : ""}
                              </p>
                              <Textarea
                                readOnly
                                rows={2}
                                className="mt-2"
                                value={ans?.response ?? "No answer submitted"}
                              />
                            </div>
                            <div className="w-28">
                              <Label className="text-xs">Marks</Label>
                              <Input
                                type="number"
                                min={0}
                                max={Number(q.marks)}
                                step={0.5}
                                defaultValue={ans?.awarded_marks ?? ""}
                                disabled={!ans}
                                onBlur={(e) =>
                                  ans &&
                                  saveMark.mutate({
                                    answerId: ans.id,
                                    marks: Number(e.target.value),
                                  })
                                }
                              />
                              {ans?.auto_marked ? (
                                <p className="mt-1 text-xs text-muted-foreground">Auto-marked</p>
                              ) : null}
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
                <FeedbackEditor
                  key={attempt.id + attempt.feedback}
                  attemptId={attempt.id}
                  initial={attempt.feedback}
                  published={activeExam.results_published}
                />
              </section>
            );
          })}

          {attempts.data?.length === 0 ? (
            <div className="panel p-8 text-center text-sm text-muted-foreground">
              No submissions yet for this examination.
            </div>
          ) : null}
        </div>
      ) : (
        <div className="panel p-8 text-center text-sm text-muted-foreground">
          Select a course with an examination to start marking.
        </div>
      )}
    </AppShell>
  );
}
