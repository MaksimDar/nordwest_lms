import { useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useProfilesMap } from "@/lib/lms";

export const MAX_EXAM_ATTEMPTS = 3;

/**
 * Rule-based early warning (FR-26). Points:
 *  - coursework not passed: +40 (exam eligibility requires passed coursework)
 *  - attempts used: 1 → +10, 2 → +30, 3+ → +50 (max 3 attempts)
 *  - task completion < 50% → +25, < 80% → +10
 *  - each overdue, unsubmitted task → +10
 * High risk ≥ 60, medium ≥ 30.
 */
export function riskScore(input: {
  courseworkPassed: boolean;
  attempts: number;
  assigned: number;
  submitted: number;
  overdue: number;
}) {
  const reasons: string[] = [];
  let score = 0;
  if (!input.courseworkPassed) {
    score += 40;
    reasons.push("coursework not passed");
  }
  if (input.attempts >= MAX_EXAM_ATTEMPTS) {
    score += 50;
    reasons.push(`all ${MAX_EXAM_ATTEMPTS} exam attempts used`);
  } else if (input.attempts === 2) {
    score += 30;
    reasons.push("2 exam attempts used");
  } else if (input.attempts === 1) score += 10;
  const rate = input.assigned ? input.submitted / input.assigned : 1;
  if (rate < 0.5) {
    score += 25;
    reasons.push(`only ${Math.round(rate * 100)}% of tasks submitted`);
  } else if (rate < 0.8) score += 10;
  if (input.overdue) {
    score += 10 * input.overdue;
    reasons.push(`${input.overdue} overdue task${input.overdue > 1 ? "s" : ""}`);
  }
  const level = score >= 60 ? "high" : score >= 30 ? "medium" : "low";
  return { score: Math.min(score, 100), level, reasons } as const;
}

export function AtRiskPanel({ lecturerId }: { lecturerId: string }) {
  const profiles = useProfilesMap();
  const [showAll, setShowAll] = useState(false);

  const data = useQuery({
    queryKey: ["at-risk", lecturerId],
    queryFn: async () => {
      const { data: courses } = await supabase
        .from("courses")
        .select("id, code")
        .eq("lecturer_id", lecturerId);
      const ids = (courses ?? []).map((c) => c.id);
      if (!ids.length) return [];
      const [{ data: enr }, { data: tasks }] = await Promise.all([
        supabase.from("enrollments").select("*").in("course_id", ids),
        supabase
          .from("tasks")
          .select("id, course_id, due_date, task_assignments(student_id, status)")
          .in("course_id", ids),
      ]);
      const today = new Date().toISOString().slice(0, 10);
      const code = new Map((courses ?? []).map((c) => [c.id, c.code]));
      return (enr ?? []).map((e) => {
        let assigned = 0,
          submitted = 0,
          overdue = 0;
        for (const t of (tasks ?? []).filter((t) => t.course_id === e.course_id)) {
          const a = t.task_assignments.find((x) => x.student_id === e.student_id);
          if (!a) continue;
          assigned++;
          if (a.status === "submitted") submitted++;
          else if (t.due_date && t.due_date < today) overdue++;
        }
        return {
          id: e.id,
          studentId: e.student_id,
          course: code.get(e.course_id) ?? "",
          ...riskScore({
            courseworkPassed: e.coursework_passed,
            attempts: e.attempts,
            assigned,
            submitted,
            overdue,
          }),
        };
      });
    },
  });

  const rows = (data.data ?? [])
    .filter((r) => r.level !== "low")
    .sort((a, b) => b.score - a.score);
  const high = rows.filter((r) => r.level === "high").length;
  const shown = showAll ? rows : rows.slice(0, 6);

  return (
    <section className="panel p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="size-5 text-destructive" />
          <h2 className="font-display text-lg font-bold">Early warning: students at risk</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          {high} high · {rows.length - high} medium risk of missing exam eligibility
        </p>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Score from coursework status, exam attempts used (max {MAX_EXAM_ATTEMPTS}), task completion and
        overdue tasks. High ≥ 60, medium ≥ 30.
      </p>
      {rows.length ? (
        <ul className="mt-4 divide-y divide-border">
          {shown.map((r) => {
            const p = profiles.data?.get(r.studentId);
            return (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="text-sm font-medium">
                    {p?.full_name ?? "Student"}{" "}
                    <span className="font-normal text-muted-foreground">
                      · {p?.student_number} · {r.course}
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground">{r.reasons.join(" · ") || "several small signals"}</p>
                </div>
                <Badge variant={r.level === "high" ? "destructive" : "secondary"}>
                  {r.level === "high" ? "High" : "Medium"} · {r.score}
                </Badge>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">No students are currently flagged.</p>
      )}
      {rows.length > 6 ? (
        <Button variant="ghost" size="sm" className="mt-2" onClick={() => setShowAll(!showAll)}>
          {showAll ? "Show fewer" : `Show all ${rows.length}`}
        </Button>
      ) : null}
    </section>
  );
}
