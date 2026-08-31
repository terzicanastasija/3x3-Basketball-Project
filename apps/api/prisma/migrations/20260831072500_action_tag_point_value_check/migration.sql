-- Enforce at the DB level that ActionTag.pointValue is NULL, 1, or 2 (never 3) —
-- Prisma's schema language can't express a CHECK constraint natively, so this is
-- hand-written. Service-layer validation already enforces this too; this is defense
-- in depth against any write path that bypasses the service layer.
ALTER TABLE "ActionTag"
  ADD CONSTRAINT "ActionTag_pointValue_check"
  CHECK ("pointValue" IS NULL OR "pointValue" IN (1, 2));
