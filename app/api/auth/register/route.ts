import { NextRequest } from 'next/server';
import { getServiceClient } from '@/lib/supabase-server';
import { json, errorResponse, handleApiError, audit, notify } from '@/lib/api-helpers';
import { z } from 'zod';

const schema = z.object({
  full_name: z.string().min(3),
  email: z.string().email(),
  phone: z.string().min(7).max(20),
  cnic: z.string().min(5).max(15),
  password: z.string().min(8),
  designation: z.string().min(2),
  department_id: z.string().uuid(),
  qualification: z.string().min(2),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message || 'Invalid registration details');
    }
    const d = parsed.data;
    const service = getServiceClient();

    const { data: created, error: createError } = await service.auth.admin.createUser({
      email: d.email,
      password: d.password,
      email_confirm: true,
    });
    if (createError || !created?.user) {
      const msg = createError?.message || '';
      if (msg.includes('already registered')) {
        return errorResponse('An account with this email already exists');
      }
      return errorResponse('Registration failed. Please try again.', 500, 'registration_failed');
    }

    const user = created.user;
    const { error: profileError } = await service.from('faculty_profiles').insert({
      user_id: user.id,
      full_name: d.full_name,
      phone: d.phone,
      cnic: d.cnic,
      designation: d.designation,
      qualification: d.qualification,
      department_id: d.department_id,
      application_status: 'Submitted',
    });
    if (profileError) {
      // Roll back the auth user so the email is not stranded
      await service.auth.admin.deleteUser(user.id);
      return errorResponse('Could not save your profile. Please try again.', 500, 'profile_failed');
    }

    await service.from('user_roles').insert({ user_id: user.id, role: 'faculty' });

    await audit(null, 'register', 'faculty_profiles', user.id, null, {
      email: d.email,
      department_id: d.department_id,
    }, 'Faculty registration submitted');

    const admins = await service.from('user_roles').select('user_id').eq('role', 'super_admin');
    for (const admin of admins.data || []) {
      if (admin.user_id) {
        await notify(admin.user_id, 'New faculty application', `${d.full_name} has registered and submitted their application.`, 'Application', '/admin/users');
      }
    }
    await notify(user.id, 'Registration received', 'Your registration has been submitted. Complete your profile and upload documents for verification.', 'Application', '/faculty/profile');

    return json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
