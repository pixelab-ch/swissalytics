import { NextResponse } from 'next/server';
import {
  getReportsRepo,
  SHARE_TOKEN_TTL_MS,
} from '@/lib/engine/repositoryInstance';

/**
 * POST /api/report/[id]/share  → enable sharing (mints a token, 30d expiry).
 * DELETE /api/report/[id]/share → revoke sharing (drops the token).
 *
 * The returned shareUrl carries an opaque token, never the report id. A
 * recipient must not be able to derive /r/<id> from what they were given —
 * that path has no expiry check, so leaking the id would make both the 30-day
 * window and the revoke button decorative.
 */

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const repo = getReportsRepo();

  const existing = await repo.getById(id);
  if (!existing) {
    return NextResponse.json({ error: 'Rapport introuvable' }, { status: 404 });
  }

  const expiresAt = Date.now() + SHARE_TOKEN_TTL_MS;
  const updated = await repo.enableSharing(id, expiresAt);
  if (!updated) {
    return NextResponse.json({ error: 'Rapport introuvable' }, { status: 404 });
  }
  if (!updated.shareToken) {
    // enableSharing always mints one; a miss means the column did not persist.
    // Fail loudly rather than hand back /s/undefined.
    return NextResponse.json(
      { error: 'Partage indisponible' },
      { status: 500 },
    );
  }

  return NextResponse.json({
    expiresAt: new Date(expiresAt).toISOString(),
    shareUrl: `/s/${updated.shareToken}`,
  });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const repo = getReportsRepo();
  const updated = await repo.disableSharing(id);
  if (!updated) {
    return NextResponse.json({ error: 'Rapport introuvable' }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
