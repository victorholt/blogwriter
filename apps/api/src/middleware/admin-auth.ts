import type { Request, Response, NextFunction } from 'express';

export function validateAdminToken(req: Request, res: Response, next: NextFunction): void {
  const token = req.params.token;
  const adminToken = process.env.ADMIN_TOKEN;

  if (!adminToken || token !== adminToken) {
    res.status(403).json({ success: false, error: 'Not found' });
    return;
  }

  next();
}
