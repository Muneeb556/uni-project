/*
# Seed reference data

1. Reference data seeded
- Departments: Computer Science, Mathematics, Economics, English
- Courses: a handful of active Theory/Practical courses per department (fictional codes)
- Semester: "Fall 2026" (Aug 2026 - Dec 2026) with attendance open 2026-09-01, attendance close 2026-12-10, billing open 2026-11-20, deadline 2026-12-15 23:59 Asia/Karachi, status Active
- Compensation rules: default per-period rates for Visiting Faculty (theory 1500, practical 1750, conveyance 500)
- System settings: university name, program, headings used by the honorarium form

2. Security
- No new tables or policy changes; rows inherit existing RLS/grants.
- No personal data of any real person is included.
*/

INSERT INTO departments (name, code) VALUES
  ('Department of Computer Science', 'CS'),
  ('Department of Mathematics', 'MATH'),
  ('Department of Economics', 'ECON'),
  ('Department of English', 'ENGL')
ON CONFLICT (code) DO NOTHING;

INSERT INTO courses (department_id, title, code, credit_hours, classification)
SELECT d.id, v.title, v.code, v.credit_hours, v.classification
FROM (VALUES
  ('CS', 'Introduction to Programming', 'CS-101', 3, 'Theory'),
  ('CS', 'Database Systems', 'CS-205', 3, 'Theory'),
  ('CS', 'Programming Lab', 'CS-102', 1, 'Practical'),
  ('CS', 'Web Technologies', 'CS-315', 3, 'Theory+Practical'),
  ('MATH', 'Calculus I', 'MATH-101', 3, 'Theory'),
  ('MATH', 'Linear Algebra', 'MATH-210', 3, 'Theory'),
  ('ECON', 'Principles of Microeconomics', 'ECON-101', 3, 'Theory'),
  ('ECON', 'Statistics for Economists', 'ECON-220', 3, 'Theory'),
  ('ENGL', 'Academic English', 'ENGL-101', 3, 'Theory')
) AS v(dept, title, code, credit_hours, classification)
JOIN departments d ON d.code = v.dept
ON CONFLICT (code, department_id) DO NOTHING;

INSERT INTO semesters (name, start_date, end_date, attendance_open, attendance_close, billing_open, billing_deadline, deadline_time, timezone, status) VALUES
  ('Fall 2026', '2026-08-03', '2026-12-18', '2026-09-01', '2026-12-10', '2026-11-20', '2026-12-15', '23:59', 'Asia/Karachi', 'Active')
ON CONFLICT (name) DO NOTHING;

INSERT INTO compensation_rules (designation, method, theory_rate, practical_rate, conveyance) VALUES
  ('Visiting Faculty', 'Per Period', 1500, 1750, 500)
ON CONFLICT DO NOTHING;

INSERT INTO system_settings (key, value) VALUES
  ('university', '{"name": "University of Karachi", "program": "Morning Program", "formTitle": "Teaching Honorarium"}'::jsonb)
ON CONFLICT (key) DO NOTHING;
