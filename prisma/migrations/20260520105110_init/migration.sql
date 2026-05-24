-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "previewText" TEXT,
    "sendDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL,
    "templateHtml" TEXT,
    "thumbnailUrl" TEXT,
    "tags" TEXT NOT NULL,
    "holiday" TEXT,
    "season" TEXT,
    "audienceNames" TEXT NOT NULL,
    "recipients" INTEGER NOT NULL DEFAULT 0,
    "openRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "clickRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ctor" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "conversionRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "revenue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "aov" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "unsubscribeRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "favorited" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Campaign_sendDate_idx" ON "Campaign"("sendDate");

-- CreateIndex
CREATE INDEX "Campaign_holiday_idx" ON "Campaign"("holiday");

-- CreateIndex
CREATE INDEX "Campaign_season_idx" ON "Campaign"("season");
