import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { convertToModelMessages, type UIMessage } from "ai";

import type { Database } from "@/integrations/supabase/types";

const NAV_GUIDE = `Portal navigation (left sidebar on desktop, buttons under the page title on phones):
Lecturers: Dashboard (courses, this week's timetable, at-risk students), meetMyStudent (student lists, enrol students, assign tasks, send reminders), teachMyStudent (course descriptions, upload slides/materials, AI summaries), testMyStudent (build and release exams), gradeMyStudent (mark submissions, AI draft feedback, publish results). "Switch to student portal" is at the bottom of the sidebar.
Students: My studies (/portal: courses, materials with AI study summaries, tasks with deadlines, exams to take), My program (degree requirements and credit progress), Course registration (register or drop courses, see free seats), My results (published grades and feedback). Notifications is at the bottom of the sidebar. Sign out is at the very bottom.`;

async function buildContext(sb: ReturnType<typeof createClient<Database>>, userId: string) {
  const [{ data: profile }, { data: roles }] = await Promise.all([
    sb.from("profiles").select("*").eq("id", userId).maybeSingle(),
    sb.from("user_roles").select("role").eq("user_id", userId),
  ]);
  const isLecturer = (roles ?? []).some((r) => r.role !== "student");
  const today = new Date().toISOString().slice(0, 10);
  const lines: string[] = [
    `Today is ${today}.`,
    `User: ${profile?.full_name ?? "unknown"} (${isLecturer ? "lecturer" : "student"}${profile?.study_course ? `, ${profile.study_course}, semester ${profile.semester_level}` : ""}).`,
  ];

  if (isLecturer) {
    const { data: courses } = await sb
      .from("courses")
      .select("id, code, name, description, credits")
      .eq("lecturer_id", userId);
    const ids = (courses ?? []).map((c) => c.id);
    const [{ data: tasks }, { data: exams }, { data: enr }] = await Promise.all([
      sb.from("tasks").select("title, due_date, course_id").in("course_id", ids),
      sb.from("exams").select("title, status, results_published, course_id").in("course_id", ids),
      sb.from("enrollments").select("course_id, coursework_passed, attempts").in("course_id", ids),
    ]);
    lines.push("Courses taught:");
    for (const c of courses ?? []) {
      const e = (enr ?? []).filter((x) => x.course_id === c.id);
      lines.push(
        `- ${c.code} ${c.name} (${c.credits} ECTS): ${c.description} | ${e.length} students, ${e.filter((x) => !x.coursework_passed).length} without passed coursework`,
      );
      for (const t of (tasks ?? []).filter((t) => t.course_id === c.id))
        lines.push(`   task "${t.title}" due ${t.due_date ?? "no date"}`);
      for (const x of (exams ?? []).filter((x) => x.course_id === c.id))
        lines.push(`   exam "${x.title}" status ${x.status}${x.results_published ? ", results published" : ""}`);
    }
  } else {
    const { data: enr } = await sb
      .from("enrollments")
      .select("attempts, coursework_passed, courses(id, code, name, description, credits, professor_name)")
      .eq("student_id", userId);
    const [{ data: tasks }, { data: exams }, { data: materials }] = await Promise.all([
      sb.from("task_assignments").select("status, tasks(title, due_date, kind)").eq("student_id", userId),
      sb.from("exams").select("title, status, scheduled_at, courses(code)").neq("status", "draft"),
      sb.from("materials").select("title, ai_summary, courses(code)"),
    ]);
    lines.push("Registered courses:");
    for (const e of enr ?? [])
      lines.push(
        `- ${e.courses?.code} ${e.courses?.name} (${e.courses?.credits} ECTS, ${e.courses?.professor_name}): ${e.courses?.description} | coursework ${e.coursework_passed ? "passed" : "not yet passed"}, exam attempts used ${e.attempts}`,
      );
    lines.push("Tasks and deadlines:");
    for (const t of tasks ?? [])
      lines.push(`- ${t.tasks?.title} (${t.tasks?.kind}) due ${t.tasks?.due_date ?? "no date"} – ${t.status}`);
    lines.push("Released exams:");
    for (const x of exams ?? []) lines.push(`- ${x.courses?.code}: ${x.title} (${x.status})`);
    lines.push("Materials:");
    for (const m of materials ?? [])
      lines.push(`- ${m.courses?.code}: ${m.title}${m.ai_summary ? ` – summary: ${m.ai_summary.slice(0, 400)}` : ""}`);
  }
  return lines.join("\n");
}

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = request.headers.get("authorization")?.replace(/^Bearer /, "");
        if (!token) return new Response("Please sign in first.", { status: 401 });
        const sb = createClient<Database>(
          process.env["SUPABASE_URL"]!,
          process.env["SUPABASE_PUBLISHABLE_KEY"]!,
          {
            global: { headers: { Authorization: `Bearer ${token}` } },
            auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
          },
        );
        const { data: userData, error } = await sb.auth.getUser(token);
        if (error || !userData.user) return new Response("Please sign in again.", { status: 401 });

        let body: { messages?: UIMessage[] };
        try {
          body = await request.json();
        } catch {
          return new Response("Invalid request", { status: 400 });
        }
        if (!Array.isArray(body.messages)) return new Response("Invalid request", { status: 400 });

        const context = await buildContext(sb, userData.user.id);
        const system = `You are "Nora", the friendly help assistant of the NordWest University learning portal.
Many users have low digital confidence: answer in short, plain sentences, avoid jargon, and give numbered click-by-click steps when explaining how to do something in the portal. Keep answers under 150 words unless asked for more.
Only state deadlines, courses and exams that appear in the data below; if something is not there, say you cannot see it and suggest where to look or whom to ask.

${NAV_GUIDE}

Live data for this user:
${context}`;

        const { streamChat } = await import("@/lib/ai/gateway.server");
        return streamChat(request, system, await convertToModelMessages(body.messages));
      },
    },
  },
});
