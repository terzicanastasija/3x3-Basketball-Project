-- AlterTable
ALTER TABLE "ActionTag" ADD COLUMN     "defenderId" TEXT,
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewedById" TEXT;

-- AlterTable
ALTER TABLE "StatSnapshot" ADD COLUMN     "possessions" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "ActionTag_defenderId_idx" ON "ActionTag"("defenderId");

-- AddForeignKey
ALTER TABLE "ActionTag" ADD CONSTRAINT "ActionTag_defenderId_fkey" FOREIGN KEY ("defenderId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionTag" ADD CONSTRAINT "ActionTag_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
