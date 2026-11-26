import { NextRequest } from 'next/server';
import { getServiceClient } from '@/lib/supabase-server';
import { json, errorResponse, handleApiError, audit, notify } from '@/lib/api-helpers';
import { z } from 'zod';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIME = ['application/pdf', 'image/jpeg', 'image/png'];

const docSchema = z.object({
  doc_type: z.enum(['CNIC', 'CV', 'Educational Certificate', 'Experience Certificate', 'Photograph', 'Other']),
  file_name: z.string().min(1),
  mime_type: z.string().refine((m) => ALLOWED_MIME.includes(m), 'Only PDF, JPG and PNG files are allowed'),
  file_size: z.number().int().max(MAX_FILE_SIZE, 'File exceeds the 5 MB limit'),
  content_base64: z.string().min(1),
});

const schema = z.object({
  full_name: z.string().min(3),
  email: z.string().email(),
  phone: z.string().min(7).max(20),
  cnic: z.string().min(5).max(15),
  password: z.string().min(8),
  designation: z.string().min(2),
  department_id: z.string().uuid(),
  qualification: z.string().min(2),
  documents: z.array(docSchema).max(6).optional().default([]),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message || 'Invalid registration details');
    }
    const d = parsed.data;

    // Validate all attached documents up front before creating user/profile
    const preparedDocs: Array<{
      doc_type: string;
      file_name: string;
      mime_type: string;
      buffer: Buffer;
    }> = [];
    const seenTypes = new Set<string>();
    for (const doc of d.documents) {
      if (seenTypes.has(doc.doc_type)) {
        return errorResponse(`Duplicate document type: ${doc.doc_type}`);
      }
      seenTypes.add(doc.doc_type);
      const buffer = Buffer.from(doc.content_base64, 'base64');
      if (buffer.length > MAX_FILE_SIZE) {
        return errorResponse(`${doc.file_name} exceeds the 5 MB limit`);
      }
      preparedDocs.push({
        doc_type: doc.doc_type,
        file_name: doc.file_name,
        mime_type: doc.mime_type,
        buffer,
      });
    }

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
    const { data: profile, error: profileError } = await service
      .from('faculty_profiles')
      .insert({
        user_id: user.id,
        full_name: d.full_name,
        phone: d.phone,
        cnic: d.cnic,
        designation: d.designation,
        qualification: d.qualification,
        department_id: d.department_id,
        application_status: 'Submitted',
      })
      .select('id')
      .single();

    if (profileError || !profile) {
      // Roll back the auth user so the email is not stranded
      await service.auth.admin.deleteUser(user.id);
      return errorResponse('Could not save your profile. Please try again.', 500, 'profile_failed');
    }

    await service.from('user_roles').insert({ user_id: user.id, role: 'faculty', department_id: d.department_id });

    let uploadedCount = 0;
    for (const doc of preparedDocs) {
      const storagePath = `${profile.id}/${doc.doc_type.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}`;
      const { error: uploadError } = await service.storage
        .from('faculty-documents')
        .upload(storagePath, doc.buffer, { contentType: doc.mime_type, upsert: false });
      if (uploadError) continue;

      const { error: docDbError } = await service.from('faculty_documents').upsert(
        {
          faculty_id: profile.id,
          doc_type: doc.doc_type,
          file_name: doc.file_name,
          storage_path: storagePath,
          mime_type: doc.mime_type,
          file_size: doc.buffer.length,
          status: 'Submitted',
          remarks: null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'faculty_id,doc_type' }
      );
      if (!docDbError) uploadedCount += 1;
    }

    await audit(null, 'register', 'faculty_profiles', user.id, null, {
      email: d.email,
      department_id: d.department_id,
      documents_uploaded: uploadedCount,
    }, 'Faculty registration submitted');

    const admins = await service.from('user_roles').select('user_id').eq('role', 'super_admin');
    for (const admin of admins.data || []) {
      if (admin.user_id) {
        await notify(
          admin.user_id,
          'New faculty application',
          `${d.full_name} has registered with ${uploadedCount} document(s) for review.`,
          'Application',
          '/admin/users'
        );
      }
    }
    await notify(
      user.id,
      'Registration received',
      uploadedCount > 0
        ? `Your registration and ${uploadedCount} document(s) have been submitted for verification.`
        : 'Your registration has been submitted. Complete your profile and upload documents for verification.',
      'Application',
      '/faculty/profile'
    );

    return json({ ok: true, documents_uploaded: uploadedCount });
  } catch (err) {
    return handleApiError(err);
  }
}
