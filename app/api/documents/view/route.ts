import { NextRequest } from 'next/server';
import { getServiceClient } from '@/lib/supabase-server';
import { json, errorResponse, handleApiError } from '@/lib/api-helpers';

// Serves a faculty document through an authenticated, short-lived signed URL.
// Access check: the requester must be the owner or a staff member.
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const docId = searchParams.get('id');
    if (!docId) return errorResponse('Document id is required');

    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
    if (!token) return errorResponse('Authentication required', 401, 'unauthorized');

    const service = getServiceClient();
    const { data: userData, error: userError } = await service.auth.getUser(token);
    if (userError || !userData?.user) return errorResponse('Authentication required', 401, 'unauthorized');

    const { data: roles } = await service.from('user_roles').select('role').eq('user_id', userData.user.id);
    const roleList = (roles || []).map((r) => r.role);
    const isStaffUser = roleList.some((r) => r !== 'faculty');

    const { data: doc } = await service.from('faculty_documents').select('*').eq('id', docId).maybeSingle();
    if (!doc) return errorResponse('Document not found', 404, 'not_found');

    if (!isStaffUser) {
      const { data: prof } = await service
        .from('faculty_profiles')
        .select('id')
        .eq('user_id', userData.user.id)
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
