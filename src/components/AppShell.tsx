import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  BookOpen,
  ClipboardList,
  Eye,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  PenSquare,
  Users,
  Bell,
  ListChecks,
  Route,
  Undo2,
} from "lucide-react";
import { useEffect, type ReactNode } from "react";

import { ChatWidget } from "@/components/ChatWidget";
import { DemoSwitcher } from "@/components/DemoSwitcher";
import { Button } from "@/components/ui/button";
import { useCurrentUser, useSignOut } from "@/lib/auth";

const lecturerNav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/meet", label: "meetMyStudent", icon: Users },
  { to: "/teach", label: "teachMyStudent", icon: BookOpen },
  { to: "/test", label: "testMyStudent", icon: PenSquare },
  { to: "/grade", label: "gradeMyStudent", icon: ClipboardList },
] as const;

const studentNav = [
  { to: "/portal", label: "My studies", icon: GraduationCap },
  { to: "/portal/program", label: "My program", icon: Route },
  { to: "/portal/register", label: "Course registration", icon: ListChecks },
  { to: "/portal/results", label: "My results", icon: ClipboardList },
] as const;

const lecturerOnlyPrefixes = ["/dashboard", "/meet", "/teach", "/test", "/grade"];

export function AppShell({
  children,
  title,
  subtitle,
  actions,
}: {
  children: ReactNode;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  const { profile, email, isLecturer, ready } = useCurrentUser();
  const signOut = useSignOut();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const onLecturerPage = lecturerOnlyPrefixes.some(
    (p) => pathname === p || pathname.startsWith(p + "/"),
  );
  const blocked = ready && !isLecturer && onLecturerPage;
  // Lecturers viewing /portal pages are in Student Preview Mode.
  const previewMode = isLecturer && pathname.startsWith("/portal");
  const lecturerMode = isLecturer && !previewMode;
  const nav = lecturerMode ? lecturerNav : studentNav;

  useEffect(() => {
    if (blocked) navigate({ to: "/portal", replace: true });
  }, [blocked, navigate]);

  if (!ready || blocked) {
    return <div className="min-h-screen bg-background" />;
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <DemoSwitcher currentEmail={email} />
      <ChatWidget isLecturer={lecturerMode} />
      {previewMode ? (
        <div className="sticky top-0 z-40 flex flex-wrap items-center justify-center gap-3 bg-primary px-4 py-2 text-sm text-primary-foreground shadow-md">
          <span className="flex items-center gap-2 font-semibold">
            <Eye className="size-4" /> Student Preview Mode — you are seeing exactly what students see
          </span>
          <Button asChild size="sm" className="gold-surface h-8">
            <Link to="/dashboard">
              <Undo2 className="size-4" /> Return to Lecturer Mode
            </Link>
          </Button>
        </div>
      ) : null}
      <div className="flex flex-1">
        <aside className="hidden w-64 shrink-0 flex-col bg-sidebar px-4 py-6 text-sidebar-foreground lg:flex">
          <Link to="/" className="mb-8 flex items-center gap-3 px-2">
            <span className="gold-surface flex size-9 items-center justify-center rounded-md font-display text-base font-bold">
              N
            </span>
            <span className="leading-tight">
              <span className="block font-display text-sm font-bold">NordWest</span>
              <span className="eyebrow text-sidebar-foreground/60">LMS</span>
            </span>
          </Link>

          <nav className="flex flex-1 flex-col gap-1">
            {nav.map((item) => {
              const active =
                pathname === item.to ||
                (item.to !== "/portal" && pathname.startsWith(item.to + "/"));
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    active
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                  }`}
                >
                  <item.icon className="size-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="mt-6 space-y-2 border-t border-sidebar-border pt-4">
            <Link
              to="/notifications"
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
            >
              <Bell className="size-4" />
              Notifications
            </Link>
            <div className="px-3 pt-2 text-xs text-sidebar-foreground/60">
              <p className="truncate font-medium text-sidebar-foreground">
                {profile?.full_name || email}
              </p>
              <p className="truncate">
                {previewMode ? "Lecturer · student preview" : isLecturer ? "Lecturer" : "Student"}
              </p>
            </div>
            <button
              onClick={signOut}
              className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
            >
              <LogOut className="size-4" />
              Sign out
            </button>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="border-b border-border bg-card px-6 py-5">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h1 className="font-display text-2xl font-bold text-foreground">{title}</h1>
                {subtitle ? (
                  <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                {actions}
                {isLecturer ? (
                  <div className="flex rounded-md border border-border p-0.5">
                    <Button asChild size="sm" variant={lecturerMode ? "default" : "ghost"}>
                      <Link to="/dashboard">
                        <LayoutDashboard className="size-4" /> Lecturer
                      </Link>
                    </Button>
                    <Button asChild size="sm" variant={previewMode ? "default" : "ghost"}>
                      <Link to="/portal">
                        <Eye className="size-4" /> Student preview
                      </Link>
                    </Button>
                  </div>
                ) : null}
              </div>
            </div>
            <nav className="mt-4 flex gap-2 overflow-x-auto lg:hidden">
              {nav.map((item) => (
                <Button key={item.to} asChild variant="secondary" size="sm">
                  <Link to={item.to}>{item.label}</Link>
                </Button>
              ))}
            </nav>
          </header>
          <main className="flex-1 px-6 py-6 pb-24">{children}</main>
        </div>
      </div>
    </div>
  );
}
