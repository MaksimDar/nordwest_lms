import { createFileRoute, Link } from "@tanstack/react-router";
import { BookOpen, ClipboardList, PenSquare, Users } from "lucide-react";

import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "NordWest LMS — Learning Management System" },
      {
        name: "description",
        content:
          "NordWest University's learning management system: one place for lecturers to meet, teach, test and grade their students.",
      },
      { property: "og:title", content: "NordWest LMS — Learning Management System" },
      {
        property: "og:description",
        content:
          "One platform for the lecturer lifetime journey: meetMyStudent, teachMyStudent, testMyStudent and gradeMyStudent.",
      },
    ],
  }),
  component: Landing,
});

const stages = [
  {
    icon: Users,
    name: "meetMyStudent",
    text: "One student overview with course, semester, student ID and attempts. Assign tasks, send reminders and open virtual classes.",
  },
  {
    icon: BookOpen,
    name: "teachMyStudent",
    text: "Course descriptions and slide sets with PDFs, videos, links, glossaries and literature in one library.",
  },
  {
    icon: PenSquare,
    name: "testMyStudent",
    text: "Build exams from multiple choice, yes/no, essay and mathematical questions, each with its own marks.",
  },
  {
    icon: ClipboardList,
    name: "gradeMyStudent",
    text: "Automatic marking where answers are known, manual marking elsewhere, then publish results to students.",
  },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="hero-surface">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <div className="flex items-center gap-3">
            <span className="gold-surface flex size-9 items-center justify-center rounded-md font-display font-bold">
              N
            </span>
            <span className="font-display text-lg font-bold">NordWest LMS</span>
          </div>
          <Button asChild variant="secondary" size="sm">
            <Link to="/auth">Sign in</Link>
          </Button>
        </div>

        <div className="mx-auto max-w-6xl px-6 pb-20 pt-10">
          <p className="eyebrow text-accent">NordWest University · Digital campus</p>
          <h1 className="mt-4 max-w-3xl text-4xl font-bold leading-tight sm:text-5xl">
            The learning platform built around the lecturer lifetime journey
          </h1>
          <p className="mt-5 max-w-2xl text-base text-primary-foreground/80">
            Courses, students, teaching material, examinations and results — four connected
            stages, one calendar, and a student portal that is always one click away.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg" className="gold-surface hover:opacity-90">
              <Link to="/auth">Create your account</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/auth">I already have an account</Link>
            </Button>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <h2 className="font-display text-2xl font-bold">Four stages, one system</h2>
        <div className="mt-8 grid gap-5 md:grid-cols-2">
          {stages.map((stage) => (
            <article key={stage.name} className="panel p-6">
              <stage.icon className="size-6 text-accent" />
              <h3 className="mt-4 font-display text-lg font-bold">{stage.name}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{stage.text}</p>
            </article>
          ))}
        </div>
      </section>

      <footer className="border-t border-border py-8 text-center text-sm text-muted-foreground">
        NordWest University · Learning Management System
      </footer>
    </div>
  );
}
