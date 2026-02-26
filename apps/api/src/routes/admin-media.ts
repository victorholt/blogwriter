import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { db } from '../db';
import { mediaFiles, appSettings } from '../db/schema';
import { eq, desc } from 'drizzle-orm';

const router = Router();

// Ensure uploads directory exists
const UPLOADS_DIR = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

async function getAllowedTypes(): Promise<string[]> {
  const [row] = await db
    .select({ value: appSettings.value })
    .from(appSettings)
    .where(eq(appSettings.key, 'media_allowed_types'))
    .limit(1);
  const raw = row?.value || 'image/jpeg,image/png,image/gif,image/webp,image/svg+xml';
  return raw.split(',').map((t) => t.trim()).filter(Boolean);
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${crypto.randomUUID()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
  fileFilter: async (_req, file, cb) => {
    try {
      const allowed = await getAllowedTypes();
      if (allowed.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error(`File type "${file.mimetype}" is not allowed`));
      }
    } catch {
      cb(new Error('Failed to check allowed types'));
    }
  },
});

// GET /api/admin/media — list all files
router.get('/', async (_req, res) => {
  try {
    const rows = await db
      .select()
      .from(mediaFiles)
      .orderBy(desc(mediaFiles.createdAt));

    // Count children per parent
    const childCounts: Record<string, number> = {};
    for (const row of rows) {
      if (row.parentId) {
        childCounts[row.parentId] = (childCounts[row.parentId] || 0) + 1;
      }
    }

    const data = rows.map((row) => ({
      ...row,
      childCount: childCounts[row.id] || 0,
    }));

    return res.json({ success: true, data });
  } catch (err) {
    console.error('[Media] Error listing files:', err);
    return res.status(500).json({ success: false, error: 'Failed to fetch media files' });
  }
});

// POST /api/admin/media — upload a file
router.post('/', (req, res) => {
  upload.single('file')(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ success: false, error: err.message });
    }
    const uploadedFile = (req as typeof req & { file?: multer.File }).file;
    if (!uploadedFile) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    const storagePath = `uploads/${uploadedFile.filename}`;
    const url = `/uploads/${uploadedFile.filename}`;

    const parentId = (req.body?.parentId as string) || null;
    const alt = (req.body?.alt as string) || '';

    // Get uploader from JWT (set by requireAdmin middleware)
    const uploadedBy = (req as unknown as { user?: { id: string } }).user?.id || null;

    try {
      const [row] = await db.insert(mediaFiles).values({
        filename: req.file.originalname,
        storagePath,
        url,
        mimeType: req.file.mimetype,
        size: req.file.size,
        parentId: parentId || null,
        alt,
        uploadedBy,
      }).returning();

      return res.json({ success: true, data: row });
    } catch (dbErr) {
      // Clean up uploaded file if DB insert fails
      fs.unlink(req.file.path, () => {});
      console.error('[Media] Error inserting media file:', dbErr);
      return res.status(500).json({ success: false, error: 'Failed to save media file' });
    }
  });
});

// PUT /api/admin/media/:id — update alt text
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { alt } = req.body as { alt: string };

  if (typeof alt !== 'string') {
    return res.status(400).json({ success: false, error: 'alt must be a string' });
  }

  try {
    const [row] = await db
      .update(mediaFiles)
      .set({ alt })
      .where(eq(mediaFiles.id, id))
      .returning();

    if (!row) {
      return res.status(404).json({ success: false, error: 'Media file not found' });
    }

    return res.json({ success: true, data: row });
  } catch (err) {
    console.error('[Media] Error updating media file:', err);
    return res.status(500).json({ success: false, error: 'Failed to update media file' });
  }
});

// DELETE /api/admin/media/:id — delete file + all children from disk and DB
router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const [parent] = await db
      .select()
      .from(mediaFiles)
      .where(eq(mediaFiles.id, id))
      .limit(1);

    if (!parent) {
      return res.status(404).json({ success: false, error: 'Media file not found' });
    }

    const children = await db
      .select()
      .from(mediaFiles)
      .where(eq(mediaFiles.parentId, id));

    // Delete child files from disk and DB
    for (const child of children) {
      const childPath = path.join(process.cwd(), child.storagePath);
      fs.unlink(childPath, () => {});
      await db.delete(mediaFiles).where(eq(mediaFiles.id, child.id));
    }

    // Delete parent file from disk and DB
    const parentPath = path.join(process.cwd(), parent.storagePath);
    fs.unlink(parentPath, () => {});
    await db.delete(mediaFiles).where(eq(mediaFiles.id, id));

    return res.json({ success: true, data: { deleted: children.length + 1 } });
  } catch (err) {
    console.error('[Media] Error deleting media file:', err);
    return res.status(500).json({ success: false, error: 'Failed to delete media file' });
  }
});

export default router;
