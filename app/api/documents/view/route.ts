import { NextRequest } from 'next/server';
import { getServiceClient } from '@/lib/supabase-server';
import { requireAuth, isStaff, json, errorResponse, handleApiError, type AuthContext } from '@/lib/api-helpers';
import type { NextResponse } from 'next/server';

function isResponse(v: AuthContext | NextResponse): v is NextResponse {
  return (v as NextResponse).status !== undefined;
}

// Serves a faculty document through an authenticated, short-lived signed URL.
// Access check: the requester must be the owner or a staff member.
export async function GET(req: NextRequest) {
  try {
    const ctx = await requireAuth(req);
    if (isResponse(ctx)) return ctx;

    const { searchParams } = new URL(req.url);
    const docId = searchParams.get('id');
    if (!docId) return errorResponse('Document id is required');

    const service = getServiceClient();
    const { data: doc } = await service.from('faculty_documents').select('*').eq('id', docId).maybeSingle();
    if (!doc) return errorResponse('Document not found', 404, 'not_found');

    if (!isStaff(ctx)) {
      const { data: prof } = await service
        .from('faculty_profiles')
        .select('id')
        .eq('user_id', ctx.userId)
        .eq('id', doc.faculty_id)
        .maybeSingle();
      if (!prof) return errorResponse('You do not have access to this document', 403, 'forbidden');
    }

    const { data: signed, error: signError } = await service.storage
      .from('faculty-documents')
      .createSignedUrl(doc.storage_path, 60);
    if (signError || !signed?.signedUrl) return errorResponse('Could not open the document', 500, 'sign_failed');
    return json({ url: signed.signedUrl, file_name: doc.file_name, mime_type: doc.mime_type });
  } catch (err) {
    return handleApiError(err);
  }
}
