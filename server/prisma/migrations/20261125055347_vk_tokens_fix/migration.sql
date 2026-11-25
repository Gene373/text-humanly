/*
  Warnings:

  - You are about to drop the column `cost` on the `RequestToken` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "RequestToken" DROP COLUMN "cost";

-- AlterTable
ALTER TABLE "VkNotification" ADD COLUMN     "totalTokens" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "VkNotification_sentAt_idx" ON "VkNotification"("sentAt");
