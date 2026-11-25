-- CreateTable
CREATE TABLE "VkNotification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "vkUserId" INTEGER NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VkNotification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RequestToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "inputTokens" INTEGER NOT NULL,
    "outputTokens" INTEGER NOT NULL,
    "totalTokens" INTEGER NOT NULL,
    "cost" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RequestToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VkNotification_userId_idx" ON "VkNotification"("userId");

-- CreateIndex
CREATE INDEX "RequestToken_userId_idx" ON "RequestToken"("userId");

-- CreateIndex
CREATE INDEX "RequestToken_requestId_idx" ON "RequestToken"("requestId");

-- AddForeignKey
ALTER TABLE "VkNotification" ADD CONSTRAINT "VkNotification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequestToken" ADD CONSTRAINT "RequestToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
