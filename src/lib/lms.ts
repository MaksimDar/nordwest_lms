import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export type Course = {
  id: string;
  code: string;
  name: string;
  description: string;
  semester: string;
  lecturer_id: string;
};

export function useMyCourses(lecturerId: string | undefined) {
  return useQuery({
    queryKey: ["courses", lecturerId],
    enabled: !!lecturerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("courses")
        .select("*")
        .eq("lecturer_id", lecturerId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Course[];
    },
  });
}

export function useProfilesMap() {
  return useQuery({
    queryKey: ["profiles-map"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, student_number, semester_level, study_course");
      if (error) throw error;
      const map = new Map<string, NonNullable<typeof data>[number]>();
      (data ?? []).forEach((p) => map.set(p.id, p));
      return map;
    },
  });
}

export const taskKinds = ["assignment", "project", "exam"] as const;
export const materialKinds = [
  "slides",
  "pdf",
  "video",
  "link",
  "glossary",
  "literature",
] as const;
export const questionKinds = [
  "multiple_choice",
  "yes_no",
  "essay",
  "mathematical",
] as const;

export function questionKindLabel(kind: string) {
  return (
    {
      multiple_choice: "Multiple choice",
      yes_no: "Yes / No",
      essay: "Essay",
      mathematical: "Mathematical",
    }[kind] ?? kind
  );
}

export function isAutoMarkable(kind: string) {
  return kind === "multiple_choice" || kind === "yes_no";
}
