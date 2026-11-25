import { NextRequest } from 'next/server';
import { requireRole, json, errorResponse, handleApiError, audit, notify } from '@/lib/api-helpers';
import { getServiceClient } from '@/lib/supabase-server';
import { z } from 'zod';

const userReviewSchema = z.object({
  user_id: z.string().uuid(),
  decision: z.enum(['Approved', 'Rejected', 'Under Review', 'Changes Required']),
  remarks: z.string().max(500).optional(),
});

// Faculty application review: approve/reject/flag with per-document control handled elsewhere
export async function POST(req: NextRequest) {
  try {
    const ctx = await requireRole(req, ['super_admin']);
    if (ctx instanceof Response) return ctx;
    const parsed = userReviewSchema.safeParse(await req.json());
    if (!parsed.success) return errorResponse('Invalid review details');
    const service = getServiceClient();

    const { data: profile } = await service
      .from('faculty_profiles')
      .select('*, departments (name)')
      .eq('user_id', parsed.data.user_id)
      .maybeSingle();
    if (!profile) return errorResponse('Faculty profile not found', 404, 'not_found');
    if (['Approved', 'Rejected'].includes(profile.application_status) && parsed.data.decision !== 'Approved') {
      return errorResponse(`Application already ${profile.application_status.toLowerCase()}`, 409, 'finalized');
    }

    const { error } = await service
      .from('faculty_profiles')
      .update({ application_status: parsed.data.decision, remarks: parsed.data.remarks || profile.remarks, updated_at: new Date().toISOString() })
      .eq('id', profile.id);
    if (error) return errorResponse(error.message, 500, 'update_failed');

    await audit(ctx, 'application.review', 'faculty_profiles', profile.id, { application_status: profile.application_status }, { application_status: parsed.data.decision }, parsed.data.remarks);
    await notify(parsed.data.user_id, `Application ${parsed.data.decision}`, parsed.data.remarks || `Your faculty application is now ${parsed.data.decision}.`, 'Application', '/faculty');

    // Reset any documents needing changes so faculty can re-upload
    if (parsed.data.decision === 'Changes Required') {
      await service
        .from('faculty_documents')
        .update({ status: 'Changes Required' })
        .eq('faculty_id', profile.id)
        .in('status', ['Submitted', 'Under Review']);
    }
    return json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}

// Per-document review
const docReviewSchema = z.object({
  document_id: z.string().uuid(),
  action: z.enum(['Approved', 'Changes Required', 'Rejected', 'Under Review']),
  remarks: z.string().max(500).optional(),
});

export async function PUT(req: NextRequest) {
  try {
    const ctx = await requireRole(req, ['super_admin', 'coordinator']);
    if (ctx instanceof Response) return ctx;
    const parsed = docReviewSchema.safeParse(await req.json());
    if (!parsed.success) return errorResponse('Invalid document review details');
    const service = getServiceClient();

    const { data: doc } = await service
      .from('faculty_documents')
      .select('*, faculty_profiles (id, user_id, full_name, department_id, application_status)')
      .eq('id', parsed.data.document_id)
      .maybeSingle();
    if (!doc) return errorResponse('Document not found', 404, 'not_found');
    const fp = doc.faculty_profiles as { id: string; user_id: string; department_id: string | null; application_status: string };

    if (ctx.roles.includes('coordinator') && !ctx.roles.includes('super_admin') && fp.department_id && !ctx.departmentIds.includes(fp.department_id)) {
      return errorResponse('This document belongs to another department', 403, 'forbidden');
    }

    const { error: docError } = await service
      .from('faculty_documents')
      .update({ status: parsed.data.action, remarks: parsed.data.remarks || null, updated_at: new Date().toISOString() })
      .eq('id', parsed.data.document_id);
    if (docError) return errorResponse(docError.message, 500, 'update_failed');
    await service.from('document_reviews').insert({
      document_id: parsed.data.document_id,
      reviewer_id: ctx.userId,
      action: parsed.data.action,
      remarks: parsed.data.remarks || null,
    });

    // Application moves to Under Review automatically when first document review starts
    if (['Submitted', 'Resubmitted'].includes(fp.application_status)) {
      await service.from('faculty_profiles').update({ application_status: 'Under Review', updated_at: new Date().toISOString() }).eq('id', fp.id);
    }
    // If every document is approved and the application was in review, approve the application
    const { data: docs } = await service.from('faculty_documents').select('status').eq('faculty_id', fp.id);
    if (docs && docs.length > 0 && docs.every((d) => d.status === 'Approved') && ['Under Review', 'Resubmitted'].includes(fp.application_status)) {
      await service.from('faculty_profiles').update({ application_status: 'Approved', remarks: null, updated_at: new Date().toISOString() }).eq('id', fp.id);
      await notify(fp.user_id, 'Application approved', 'All your documents have been verified and your faculty application is approved.', 'Application', '/faculty');
    }

    await audit(ctx, 'document.review', 'faculty_documents', parsed.data.document_id, { status: doc.status }, { status: parsed.data.action }, parsed.data.remarks);
    await notify(fp.user_id, `Document ${parsed.data.action}`, parsed.data.remarks || `Your ${doc.doc_type} is now ${parsed.data.action}.`, 'Documents', '/faculty/documents');
    return json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
