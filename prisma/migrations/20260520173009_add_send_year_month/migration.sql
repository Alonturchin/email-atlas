-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN     "sendMonth" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "sendYear" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "Campaign_sendYear_sendMonth_idx" ON "Campaign"("sendYear", "sendMonth");
