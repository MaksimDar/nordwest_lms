import { supabase } from "@/integrations/supabase/client";

// Shared demonstration password for the pre-created university accounts.
export const DEMO_PASSWORD = "NordWest2026!";

export const demoAccounts = [
  {
    key: "anna",
    name: "Prof. Dr. Anna Müller",
    role: "Professor · Computer Science & Software Engineering",
    email: "anna.mueller@nordwest.edu",
    home: "/dashboard",
  },
  {
    key: "max",
    name: "Max Schneider",
    role: "Student · B.Sc. Computer Science, semester 3",
    email: "max.schneider@nordwest.edu",
    home: "/portal",
  },
] as const;

export async function signInAsDemo(key: (typeof demoAccounts)[number]["key"]) {
  const acc = demoAccounts.find((a) => a.key === key)!;
  await supabase.auth.signOut();
  const { error } = await supabase.auth.signInWithPassword({
    email: acc.email,
    password: DEMO_PASSWORD,
  });
  if (error) throw error;
  window.location.href = acc.home;
}
