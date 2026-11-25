import { NextRequest } from 'next/server';
import { requireRole, json, errorResponse, handleApiError, audit, notify } from '@/lib/api-helpers';
import { getServiceClient } from '@/lib/supabase-server';
import { z } from 'zod';

const departmentSchema = z.object({
  name: z.string().min(2),
  code: z.string().min(1).max(10),
  status: z.enum(['Active', 'Inactive']).default('Active'),
});

const courseSchema = z.object({
  department_id: z.string().uuid(),
  title: z.string().min(2),
  code: z.string().min(1).max(20),
  credit_hours: z.number().int().min(1).max(6).default(3),
  classification: z.enum(['Theory', 'Practical', 'Theory+Practical']).default('Theory'),
  status: z.enum(['Active', 'Inactive']).default('Active'),
});

const semesterSchema = z.object({
  name: z.string().min(2),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  attendance_open: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  attendance_close: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  billing_open: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  billing_deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  deadline_time: z.string().regex(/^\d{2}:\d{2}$/).default('23:59'),
  timezone: z.string().default('Asia/Karachi'),
  status: z.enum(['Upcoming', 'Active', 'Attendance Closing', 'Billing Open', 'Closed', 'Archived']).default('Upcoming'),
});

const assignmentSchema = z.object({
  faculty_id: z.string().uuid(),
  department_id: z.string().uuid(),
  semester_id: z.string().uuid(),
  course_id: z.string().uuid(),
  number_of_students: z.number().int().min(0).max(1000).default(0),
  classification: z.enum(['Theory', 'Practical']).default('Theory'),
  teaching_days: z.array(z.string()).default([]),
  start_time: z.string().optional(),
  end_time: z.string().optional(),
  number_of_periods: z.number().int().min(1).max(12).default(1),
  compensation_method: z.enum(['Per Hour', 'Per Period', 'Per Course Fixed', 'Custom']).default('Per Period'),
  theory_rate: z.number().min(0).default(0),
  practical_rate: z.number().min(0).default(0),
  conveyance: z.number().min(0).default(0),
});

const roleSchema = z.object({
  user_id: z.string().uuid(),
  role: z.enum(['faculty', 'super_admin', 'coordinator', 'accounts', 'approver']),
  department_id: z.string().uuid().nullable().optional(),
});

const settingsSchema = z.object({
  key: z.string().min(1),
  value: z.record(z.string(), z.unknown()),
});

export async function POST(req: NextRequest) {
  try {
    const ctx = await requireRole(req, ['super_admin']);
    if (ctx instanceof Response) return ctx;
    const body = await req.json();
    const entity = body?.entity as string;
    const service = getServiceClient();
    const payload = body?.data || {};

    switch (entity) {
      case 'department': {
        const p = departmentSchema.safeParse(payload);
        if (!p.success) return errorResponse(p.error.issues[0]?.message || 'Invalid department');
        const { data, error } = await service.from('departments').upsert(p.data, { onConflict: 'code' }).select('*').single();
        if (error) return errorResponse(error.message, 500, 'db');
        await audit(ctx, 'department.upsert', 'departments', data.id, null, p.data);
        return json(data);
      }
      case 'course': {
        const p = courseSchema.safeParse(payload);
        if (!p.success) return errorResponse(p.error.issues[0]?.message || 'Invalid course');
        const { data, error } = await service.from('courses').upsert(p.data, { onConflict: 'code,department_id' }).select('*').single();
        if (error) return errorResponse(error.message, 500, 'db');
        await audit(ctx, 'course.upsert', 'courses', data.id, null, p.data);
        return json(data);
      }
      case 'semester': {
        const p = semesterSchema.safeParse(payload);
        if (!p.success) return errorResponse(p.error.issues[0]?.message || 'Invalid semester');
        if (p.data.start_date >= p.data.end_date) return errorResponse('End date must be after start date');
        if (p.data.billing_deadline < p.data.billing_open) return errorResponse('Billing deadline must be after billing opening date');
        const { data, error } = await service.from('semesters').upsert(p.data, { onConflict: 'name' }).select('*').single();
        if (error) return errorResponse(error.message, 500, 'db');
        await audit(ctx, 'semester.upsert', 'semesters', data.id, null, p.data);
        return json(data);
      }
      case 'assignment': {
        const p = assignmentSchema.safeParse(payload);
        if (!p.success) return errorResponse(p.error.issues[0]?.message || 'Invalid assignment');
        const { data: prof } = await service.from('faculty_profiles').select('id, application_status').eq('id', p.data.faculty_id).maybeSingle();
        if (!prof) return errorResponse('Faculty not found', 404, 'not_found');
        if (prof.application_status !== 'Approved') return errorResponse('Courses can only be assigned to approved faculty', 422, 'not_approved');
        const { data, error } = await service
          .from('faculty_assignments')
          .upsert(p.data, { onConflict: 'faculty_id,semester_id,course_id' })
          .select('*')
          .single();
        if (error) return errorResponse(error.message, 500, 'db');
        await audit(ctx, 'assignment.upsert', 'faculty_assignments', data.id, null, p.data);
        const { data: profUser } = await service.from('faculty_profiles').select('user_id').eq('id', p.data.faculty_id).maybeSingle();
        if (profUser?.user_id) {
          await notify(profUser.user_id, 'Course assigned', 'A new course assignment was added for the current semester.', 'Assignment', '/faculty/courses');
        }
        return json(data);
      }
      case 'role': {
        const p = roleSchema.safeParse(payload);
        if (!p.success) return errorResponse('Invalid role assignment');
        const { error } = await service.from('user_roles').upsert({
          user_id: p.data.user_id,
          role: p.data.role,
          department_id: p.data.department_id ?? null,
        }, { onConflict: 'user_id,role,department_id' });
        if (error) return errorResponse(error.message, 500, 'db');
        await audit(ctx, 'role.assign', 'user_roles', p.data.user_id, null, p.data);
        return json({ ok: true });
      }
      case 'settings': {
        const p = settingsSchema.safeParse(payload);
        if (!p.success) return errorResponse('Invalid settings');
        const { error } = await service
          .from('system_settings')
          .upsert({ key: p.data.key, value: p.data.value as never, updated_by: ctx.userId, updated_at: new Date().toISOString() }, { onConflict: 'key' });
        if (error) return errorResponse(error.message, 500, 'db');
        await audit(ctx, 'settings.update', 'system_settings', null, null, p.data);
        return json({ ok: true });
      }
      case 'compensation': {
        const p = z.object({
          department_id: z.string().uuid().nullable().optional(),
          designation: z.string().nullable().optional(),
          method: z.enum(['Per Hour', 'Per Period', 'Per Course Fixed', 'Custom']).default('Per Period'),
          theory_rate: z.number().min(0),
          practical_rate: z.number().min(0),
          conveyance: z.number().min(0).default(0),
        }).safeParse(payload);
        if (!p.success) return errorResponse('Invalid compensation rule');
        const { data, error } = await service.from('compensation_rules').insert(p.data).select('*').single();
        if (error) return errorResponse(error.message, 500, 'db');
        await audit(ctx, 'compensation.create', 'compensation_rules', data.id, null, p.data);
        return json(data);
      }
      case 'extension': {
        const p = z.object({
          semester_id: z.string().uuid(),
          extension_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
          extension_remarks: z.string().min(5).max(500),
        }).safeParse(payload);
        if (!p.success) return errorResponse('Invalid extension details');
        const { data: before } = await service.from('semesters').select('*').eq('id', p.data.semester_id).maybeSingle();
        if (!before) return errorResponse('Semester not found', 404, 'not_found');
        if (p.data.extension_date < before.billing_deadline) return errorResponse('Extension must be after the current deadline');
        const { error } = await service
          .from('semesters')
          .update({ extension_date: p.data.extension_date, extension_remarks: p.data.extension_remarks, extension_authorized_by: ctx.userId })
          .eq('id', p.data.semester_id);
        if (error) return errorResponse(error.message, 500, 'db');
        await audit(ctx, 'semester.deadline.extend', 'semesters', p.data.semester_id, { billing_deadline: before.billing_deadline }, { extension_date: p.data.extension_date }, p.data.extension_remarks);
        return json({ ok: true });
      }
      default:
        return errorResponse('Unknown entity');
    }
  } catch (err) {
    return handleApiError(err);
  }
}
