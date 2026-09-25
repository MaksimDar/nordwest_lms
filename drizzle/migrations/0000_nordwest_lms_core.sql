
-- ROLES
CREATE TYPE public.app_role AS ENUM ('lecturer','student','admin');

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  student_number text,
  semester_level int,
  study_course text,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE POLICY "own roles readable" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "profiles readable by authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- signup trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.app_role;
BEGIN
  INSERT INTO public.profiles (id, full_name, student_number, study_course, semester_level)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email,'@',1)),
    NEW.raw_user_meta_data->>'student_number',
    NEW.raw_user_meta_data->>'study_course',
    NULLIF(NEW.raw_user_meta_data->>'semester_level','')::int
  )
  ON CONFLICT (id) DO NOTHING;

  r := CASE WHEN COALESCE(NEW.raw_user_meta_data->>'role','student') = 'lecturer' THEN 'lecturer'::public.app_role ELSE 'student'::public.app_role END;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, r) ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- COURSES
CREATE TABLE public.courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lecturer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  semester text NOT NULL DEFAULT '',
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.courses TO authenticated;
GRANT ALL ON public.courses TO service_role;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lecturer manages own courses" ON public.courses FOR ALL TO authenticated
  USING (auth.uid() = lecturer_id) WITH CHECK (auth.uid() = lecturer_id);
CREATE POLICY "authenticated can read courses" ON public.courses FOR SELECT TO authenticated USING (true);

-- ENROLMENTS
CREATE TABLE public.enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  semester_level int NOT NULL DEFAULT 1,
  attempts int NOT NULL DEFAULT 0,
  coursework_passed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (course_id, student_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.enrollments TO authenticated;
GRANT ALL ON public.enrollments TO service_role;
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lecturer manages enrolments of own courses" ON public.enrollments FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.courses c WHERE c.id = course_id AND c.lecturer_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.courses c WHERE c.id = course_id AND c.lecturer_id = auth.uid()));
CREATE POLICY "student reads own enrolments" ON public.enrollments FOR SELECT TO authenticated USING (auth.uid() = student_id);
CREATE POLICY "student self enrols" ON public.enrollments FOR INSERT TO authenticated WITH CHECK (auth.uid() = student_id);

-- MATERIALS
CREATE TABLE public.materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  title text NOT NULL,
  kind text NOT NULL DEFAULT 'slides',
  lecture_date date,
  url text,
  file_path text,
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.materials TO authenticated;
GRANT ALL ON public.materials TO service_role;
ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lecturer manages own materials" ON public.materials FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.courses c WHERE c.id = course_id AND c.lecturer_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.courses c WHERE c.id = course_id AND c.lecturer_id = auth.uid()));
CREATE POLICY "enrolled student reads materials" ON public.materials FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.enrollments e WHERE e.course_id = course_id AND e.student_id = auth.uid()));

-- TASKS
CREATE TABLE public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  title text NOT NULL,
  kind text NOT NULL DEFAULT 'assignment',
  description text NOT NULL DEFAULT '',
  due_date date,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks TO authenticated;
GRANT ALL ON public.tasks TO service_role;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lecturer manages own tasks" ON public.tasks FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.courses c WHERE c.id = course_id AND c.lecturer_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.courses c WHERE c.id = course_id AND c.lecturer_id = auth.uid()));
CREATE POLICY "enrolled student reads tasks" ON public.tasks FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.enrollments e WHERE e.course_id = course_id AND e.student_id = auth.uid()));

CREATE TABLE public.task_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'assigned',
  submitted_at timestamptz,
  UNIQUE (task_id, student_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_assignments TO authenticated;
GRANT ALL ON public.task_assignments TO service_role;
ALTER TABLE public.task_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lecturer manages task assignments" ON public.task_assignments FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.tasks t JOIN public.courses c ON c.id = t.course_id WHERE t.id = task_id AND c.lecturer_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.tasks t JOIN public.courses c ON c.id = t.course_id WHERE t.id = task_id AND c.lecturer_id = auth.uid()));
CREATE POLICY "student reads own task assignments" ON public.task_assignments FOR SELECT TO authenticated USING (auth.uid() = student_id);
CREATE POLICY "student updates own task assignments" ON public.task_assignments FOR UPDATE TO authenticated USING (auth.uid() = student_id);

-- EXAMS
CREATE TABLE public.exams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  title text NOT NULL,
  scheduled_at timestamptz,
  status text NOT NULL DEFAULT 'draft',
  results_published boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exams TO authenticated;
GRANT ALL ON public.exams TO service_role;
ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lecturer manages own exams" ON public.exams FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.courses c WHERE c.id = course_id AND c.lecturer_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.courses c WHERE c.id = course_id AND c.lecturer_id = auth.uid()));
CREATE POLICY "enrolled student reads released exams" ON public.exams FOR SELECT TO authenticated
  USING (status <> 'draft' AND EXISTS (SELECT 1 FROM public.enrollments e WHERE e.course_id = course_id AND e.student_id = auth.uid()));

CREATE TABLE public.exam_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id uuid NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
  position int NOT NULL DEFAULT 1,
  kind text NOT NULL DEFAULT 'multiple_choice',
  prompt text NOT NULL,
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  correct_answer text,
  marks numeric NOT NULL DEFAULT 1
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exam_questions TO authenticated;
GRANT ALL ON public.exam_questions TO service_role;
ALTER TABLE public.exam_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lecturer manages own questions" ON public.exam_questions FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.exams x JOIN public.courses c ON c.id = x.course_id WHERE x.id = exam_id AND c.lecturer_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.exams x JOIN public.courses c ON c.id = x.course_id WHERE x.id = exam_id AND c.lecturer_id = auth.uid()));
CREATE POLICY "enrolled student reads released questions" ON public.exam_questions FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.exams x JOIN public.enrollments e ON e.course_id = x.course_id
    WHERE x.id = exam_id AND x.status <> 'draft' AND e.student_id = auth.uid()
  ));

CREATE TABLE public.exam_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id uuid NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  submitted_at timestamptz,
  score numeric,
  max_score numeric,
  graded boolean NOT NULL DEFAULT false,
  feedback text NOT NULL DEFAULT '',
  UNIQUE (exam_id, student_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exam_attempts TO authenticated;
GRANT ALL ON public.exam_attempts TO service_role;
ALTER TABLE public.exam_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lecturer manages attempts of own exams" ON public.exam_attempts FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.exams x JOIN public.courses c ON c.id = x.course_id WHERE x.id = exam_id AND c.lecturer_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.exams x JOIN public.courses c ON c.id = x.course_id WHERE x.id = exam_id AND c.lecturer_id = auth.uid()));
CREATE POLICY "student reads own attempts" ON public.exam_attempts FOR SELECT TO authenticated USING (auth.uid() = student_id);
CREATE POLICY "student creates own attempt" ON public.exam_attempts FOR INSERT TO authenticated WITH CHECK (auth.uid() = student_id);
CREATE POLICY "student updates own attempt" ON public.exam_attempts FOR UPDATE TO authenticated USING (auth.uid() = student_id AND graded = false);

CREATE TABLE public.exam_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id uuid NOT NULL REFERENCES public.exam_attempts(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.exam_questions(id) ON DELETE CASCADE,
  response text NOT NULL DEFAULT '',
  awarded_marks numeric,
  auto_marked boolean NOT NULL DEFAULT false,
  UNIQUE (attempt_id, question_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exam_answers TO authenticated;
GRANT ALL ON public.exam_answers TO service_role;
ALTER TABLE public.exam_answers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lecturer manages answers of own exams" ON public.exam_answers FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.exam_attempts a JOIN public.exams x ON x.id = a.exam_id JOIN public.courses c ON c.id = x.course_id
    WHERE a.id = attempt_id AND c.lecturer_id = auth.uid()))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.exam_attempts a JOIN public.exams x ON x.id = a.exam_id JOIN public.courses c ON c.id = x.course_id
    WHERE a.id = attempt_id AND c.lecturer_id = auth.uid()));
CREATE POLICY "student manages own answers" ON public.exam_answers FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.exam_attempts a WHERE a.id = attempt_id AND a.student_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.exam_attempts a WHERE a.id = attempt_id AND a.student_id = auth.uid()));

-- TIMETABLE / CALENDAR
CREATE TABLE public.timetable_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid REFERENCES public.courses(id) ON DELETE CASCADE,
  lecturer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz,
  meeting_url text,
  kind text NOT NULL DEFAULT 'lecture',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.timetable_events TO authenticated;
GRANT ALL ON public.timetable_events TO service_role;
ALTER TABLE public.timetable_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lecturer manages own events" ON public.timetable_events FOR ALL TO authenticated
  USING (auth.uid() = lecturer_id) WITH CHECK (auth.uid() = lecturer_id);
CREATE POLICY "enrolled student reads events" ON public.timetable_events FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.enrollments e WHERE e.course_id = timetable_events.course_id AND e.student_id = auth.uid()));

-- NOTIFICATIONS
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "recipient reads own notifications" ON public.notifications FOR SELECT TO authenticated USING (auth.uid() = recipient_id);
CREATE POLICY "recipient updates own notifications" ON public.notifications FOR UPDATE TO authenticated USING (auth.uid() = recipient_id);
CREATE POLICY "lecturer sends notifications" ON public.notifications FOR INSERT TO authenticated WITH CHECK (auth.uid() = sender_id);
