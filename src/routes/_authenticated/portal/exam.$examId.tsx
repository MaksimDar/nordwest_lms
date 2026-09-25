import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/lib/auth";
import { questionKindLabel } from "@/lib/lms";

export const Route = createFileRoute("/_authenticated/portal/exam/$examId")({
  head: () => ({
    meta: [
      { title: "Write examination — NordWest LMS" },
      {
        name: "description",
        content: "Answer your released NordWest University examination and submit it for marking.",
      },
      { property: "og:title", content: "Write examination — NordWest LMS" },
      {
        property: "og:description",
        content: "Answer and submit your NordWest examination.",
      },
    ],
  }),
  component: WriteExam,
});

function WriteExam() {
  const { examId } = Route.useParams();
  const { user } = useCurrentUser();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const exam = useQuery({
    queryKey: ["exam", examId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exams")
        .select("*, courses(code, name)")
        .eq("id", examId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const questions = useQuery({
    queryKey: ["exam-questions", examId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exam_questions")
        .select("id, position, kind, prompt, options, marks")
        .eq("exam_id", examId)
        .order("position");
      if (error) throw error;
      return data ?? [];
    },
  });

  const attempt = useQuery({
    queryKey: ["my-attempt", examId, user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const existing = await supabase
        .from("exam_attempts")
        .select("*, exam_answers(*)")
        .eq("exam_id", examId)
        .eq("student_id", user!.id)
        .maybeSingle();
      if (existing.data) return existing.data;
      const created = await supabase
        .from("exam_attempts")
        .insert({ exam_id: examId, student_id: user!.id })
        .select("*, exam_answers(*)")
        .single();
      if (created.error) throw created.error;
      return created.data;
    },
  });

  useEffect(() => {
    const saved: Record<string, string> = {};
    (attempt.data?.exam_answers ?? []).forEach((a: { question_id: string; response: string }) => {
      saved[a.question_id] = a.response;
    });
    setAnswers((prev) => ({ ...saved, ...prev }));
  }, [attempt.data]);

  const submit = useMutation({
    mutationFn: async () => {
      const attemptId = attempt.data?.id;
      if (!attemptId) throw new Error("No attempt found");
      const rows = (questions.data ?? []).map((q) => ({
        attempt_id: attemptId,
        question_id: q.id,
        response: answers[q.id] ?? "",
      }));
      if (rows.length) {
        const { error } = await supabase
          .from("exam_answers")
          .upsert(rows, { onConflict: "attempt_id,question_id" });
        if (error) throw error;
      }
      const { error: aErr } = await supabase
        .from("exam_attempts")
        .update({ submitted_at: new Date().toISOString() })
        .eq("id", attemptId);
      if (aErr) throw aErr;
    },
    onSuccess: () => {
      toast.success("Examination submitted");
      queryClient.invalidateQueries();
      navigate({ to: "/portal/results" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const submitted = !!attempt.data?.submitted_at;

  return (
    <AppShell
      title={exam.data?.title ?? "Examination"}
      subtitle={
        exam.data?.courses
          ? `${exam.data.courses.code} · ${exam.data.courses.name}`
          : "Answer every question, then submit."
      }
      actions={
        <Button onClick={() => submit.mutate()} disabled={submitted || submit.isPending}>
          {submitted ? "Already submitted" : "Submit examination"}
        </Button>
      }
    >
      {submitted ? (
        <div className="panel mb-6 p-5 text-sm text-muted-foreground">
          You submitted this examination on{" "}
          {new Date(attempt.data!.submitted_at as string).toLocaleString()}. Your result appears in
          My results once your lecturer publishes it.
        </div>
      ) : null}

      <ol className="space-y-5">
        {(questions.data ?? []).map((q, i) => (
          <li key={q.id} className="panel p-6">
            <div className="flex items-start justify-between gap-4">
              <p className="font-medium">
                {i + 1}. {q.prompt}
              </p>
              <div className="flex shrink-0 gap-2">
                <Badge variant="secondary">{questionKindLabel(q.kind)}</Badge>
                <Badge>{q.marks} marks</Badge>
              </div>
            </div>

            <div className="mt-4">
              {q.kind === "multiple_choice" && Array.isArray(q.options) && q.options.length ? (
                <RadioGroup
                  value={answers[q.id] ?? ""}
                  onValueChange={(v) => setAnswers((p) => ({ ...p, [q.id]: v }))}
                  disabled={submitted}
                >
                  {(q.options as string[]).map((o) => (
                    <div key={o} className="flex items-center gap-2">
                      <RadioGroupItem value={o} id={`${q.id}-${o}`} />
                      <Label htmlFor={`${q.id}-${o}`}>{o}</Label>
                    </div>
                  ))}
                </RadioGroup>
              ) : q.kind === "yes_no" ? (
                <RadioGroup
                  value={answers[q.id] ?? ""}
                  onValueChange={(v) => setAnswers((p) => ({ ...p, [q.id]: v }))}
                  disabled={submitted}
                >
                  {["yes", "no"].map((o) => (
                    <div key={o} className="flex items-center gap-2">
                      <RadioGroupItem value={o} id={`${q.id}-${o}`} />
                      <Label htmlFor={`${q.id}-${o}`} className="capitalize">
                        {o}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              ) : q.kind === "mathematical" ? (
                <Input
                  value={answers[q.id] ?? ""}
                  disabled={submitted}
                  placeholder="Your calculation and result"
                  onChange={(e) => setAnswers((p) => ({ ...p, [q.id]: e.target.value }))}
                />
              ) : (
                <Textarea
                  rows={6}
                  value={answers[q.id] ?? ""}
                  disabled={submitted}
                  placeholder="Your answer"
                  onChange={(e) => setAnswers((p) => ({ ...p, [q.id]: e.target.value }))}
                />
              )}
            </div>
          </li>
        ))}
        {questions.data?.length === 0 ? (
          <li className="panel p-8 text-center text-sm text-muted-foreground">
            This examination has no questions yet.
          </li>
        ) : null}
      </ol>
    </AppShell>
  );
}
