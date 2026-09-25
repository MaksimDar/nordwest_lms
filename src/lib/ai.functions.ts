import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const summarizeMaterial = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ materialId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { generateOnce } = await import("./ai/gateway.server");
    const sb = context.supabase;
    const { data: m, error } = await sb
      .from("materials")
      .select("*, courses(code, name)")
      .eq("id", data.materialId)
      .maybeSingle();
    if (error || !m) throw new Error("Material not found");

    await sb.from("materials").update({ summary_status: "pending" }).eq("id", m.id);

    type Part =
      | { type: "text"; text: string }
      | { type: "file"; data: Uint8Array; mediaType: string; filename?: string };
    const parts: Part[] = [
      {
        type: "text",
        text: `Course: ${m.courses?.code} ${m.courses?.name}\nMaterial: ${m.title} (${m.kind})\nLecturer notes:\n${m.notes || "(none)"}\n${m.url ? `Link: ${m.url}` : ""}`,
      },
    ];
    if (m.file_path) {
      const { data: blob } = await sb.storage.from("course-materials").download(m.file_path);
      if (blob) {
        const lower = m.file_path.toLowerCase();
        if (lower.endsWith(".pdf")) {
          parts.push({
            type: "file",
            data: new Uint8Array(await blob.arrayBuffer()),
            mediaType: "application/pdf",
            filename: m.file_path.split("/").pop() ?? "material.pdf",
          });
        } else if (/\.(txt|md|csv|html?)$/.test(lower)) {
          parts.push({ type: "text", text: (await blob.text()).slice(0, 60000) });
        }
      }
    }

    try {
      const summary = await generateOnce(
        "You write concise study summaries for university students, many with low digital confidence. Use simple English and markdown: a one-sentence overview, then 4-7 bullet points of key ideas, then 2-3 'Check yourself' questions. Stay under 220 words. Only use information from the material; if little content is available, say so briefly and summarise what is known.",
        [{ role: "user", content: parts }],
      );
      await sb
        .from("materials")
        .update({ ai_summary: summary, summary_status: "ready" })
        .eq("id", m.id);
      return { summary };
    } catch (e) {
      await sb.from("materials").update({ summary_status: "failed" }).eq("id", m.id);
      throw e;
    }
  });

export const draftExamFeedback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ attemptId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { generateOnce } = await import("./ai/gateway.server");
    const sb = context.supabase;
    const { data: attempt, error } = await sb
      .from("exam_attempts")
      .select("*, exam_answers(*), exams(title, courses(code, name))")
      .eq("id", data.attemptId)
      .maybeSingle();
    if (error || !attempt) throw new Error("Submission not found");
    const { data: questions } = await sb
      .from("exam_questions")
      .select("*")
      .eq("exam_id", attempt.exam_id)
      .order("position");
    const { data: student } = await sb
      .from("profiles")
      .select("full_name")
      .eq("id", attempt.student_id)
      .maybeSingle();

    const lines = (questions ?? []).map((q, i) => {
      const a = (attempt.exam_answers ?? []).find((x) => x.question_id === q.id);
      return `Q${i + 1} (${q.kind}, ${q.marks} marks): ${q.prompt}\nModel answer: ${q.correct_answer ?? "none – marked by the lecturer"}\nStudent answer: ${a?.response || "(no answer)"}\nAwarded: ${a?.awarded_marks ?? "not yet marked"}`;
    });

    const feedback = await generateOnce(
      "You are a supportive university lecturer's marking assistant. Write draft feedback addressed directly to the student (use 'you'). Plain text, no markdown headings. Structure: one opening sentence on overall performance, then one short line per question starting with 'Q1:', 'Q2:' etc. noting what was good or what to improve, then one closing tip. Under 170 words. Be encouraging, specific and honest. Do not invent marks.",
      [
        {
          role: "user",
          content: `Exam: ${attempt.exams?.title} (${attempt.exams?.courses?.code})\nStudent: ${student?.full_name ?? "Student"}\n\n${lines.join("\n\n")}`,
        },
      ],
    );
    const { error: saveError } = await sb
      .from("exam_attempts")
      .update({ feedback })
      .eq("id", attempt.id);
    if (saveError) throw new Error(saveError.message);
    return { feedback };
  });
