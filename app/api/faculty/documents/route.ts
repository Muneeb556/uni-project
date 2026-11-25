import { NextRequest } from 'next/server';
import { requireAuth, json, errorResponse, handleApiError, getFacultyProfile, audit, notify, type AuthContext } from '@/lib/api-helpers';
import type { NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase-server';
import { z } from 'zod';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIME = ['application/pdf', 'image/jpeg', 'image/png'];

const schema = z.object({
  doc_type: z.enum(['CNIC', 'CV', 'Educational Certificate', 'Experience Certificate', 'Photograph', 'Other']),
  file_name: z.string().min(1),
  mime_type: z.string().refine((m) => ALLOWED_MIME.includes(m), 'Only PDF, JPG and PNG files are allowed'),
  file_size: z.number().int().max(MAX_FILE_SIZE, 'File exceeds the 5 MB limit'),
  content_base64: z.string().min(1),
});

function isResponse(v: AuthContext | NextResponse): v is NextResponse {
  return (v as NextResponse).status !== undefined;
}

export async function GET(req: NextRequest) {
  try {
    const ctx = await requireAuth(req);
    if (isResponse(ctx)) return ctx;
    const profile = await getFacultyProfile(ctx);
    if (!profile) return json([]);
    const { data, error } = await ctx.client
      .from('faculty_documents')
      .select('*')
      .eq('faculty_id', profile.id)
      .order('created_at', { ascending: true });
    if (error) return errorResponse(error.message, 500, 'query_failed');
    return json(data);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await requireAuth(req);
    if (isResponse(ctx)) return ctx;
    const profile = await getFacultyProfile(ctx);
    if (!profile) return errorResponse('Profile not found', 404, 'not_found');
    if (profile.application_status === 'Approved' || profile.application_status === 'Rejected') {
      return errorResponse('Your application is finalized; documents can no longer be replaced. Contact the registrar.', 403, 'locked');
    }

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return errorResponse(parsed.error.issues[0]?.message || 'Invalid document');
    const d = parsed.data;
    const service = getServiceClient();

    const buffer = Buffer.from(d.content_base64, 'base64');
    if (buffer.length > MAX_FILE_SIZE) return errorResponse('File exceeds the 5 MB limit');
    const storagePath = `${profile.id}/${d.doc_type.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}`;

    const { error: uploadError } = await service.storage
      .from('faculty-documents')
      .upload(storagePath, buffer, { contentType: d.mime_type, upsert: false });
    if (uploadError) return errorResponse('Document storage failed. Please try again.', 500, 'upload_failed');

    const { data: doc, error: dbError } = await service
      .from('faculty_documents')
      .upsert(
        {
          faculty_id: profile.id,
          doc_type: d.doc_type,
          file_name: d.file_name,
          storage_path: storagePath,
          mime_type: d.mime_type,
          file_size: buffer.length,
          status: 'Submitted',
          remarks: null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'faculty_id,doc_type' }
      )
      .select('*')
      .single();
    if (dbError) return errorResponse(dbError.message, 500, 'db_failed');

    // Any resubmission pushes a finalized decision back to review
    if (['Changes Required', 'Rejected'].includes(profile.application_status)) {
      await service
        .from('faculty_profiles')
        .update({ application_status: 'Resubmitted', updated_at: new Date().toISOString() })
        .eq('id', profile.id);
    }

    await audit(ctx, 'document.upload', 'faculty_documents', doc.id, null, { doc_type: d.doc_type, file_name: d.file_name });
    return json(doc);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const ctx = await requireAuth(req);
    if (isResponse(ctx)) return ctx;
    const profile = await getFacultyProfile(ctx);
    if (!profile) return errorResponse('Profile not found', 404, 'not_found');
    const { searchParams } = new URL(req.url);
    const docId = searchParams.get('id');
    if (!docId) return errorResponse('Document id is required');

    const { data: doc } = await ctx.client
      .from('faculty_documents')
      .select('*')
      .eq('id', docId)
      .eq('faculty_id', profile.id)
      .maybeSingle();
    if (!doc) return errorResponse('Document not found', 404, 'not_found');

    const service = getServiceClient();
    await service.storage.from('faculty-documents').remove([doc.storage_path]);
    const { error: delError } = await service.from('faculty_documents').delete().eq('id', docId);
    if (delError) return errorResponse(delError.message, 500, 'delete_failed');
    await audit(ctx, 'document.delete', 'faculty_documents', docId, doc, null);
    return json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
