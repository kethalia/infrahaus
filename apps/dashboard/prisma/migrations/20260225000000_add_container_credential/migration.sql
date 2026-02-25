-- CreateTable
CREATE TABLE "ContainerCredential" (
    "id" TEXT NOT NULL,
    "containerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sshPrivateKey" TEXT NOT NULL,
    "sshPublicKey" TEXT NOT NULL,
    "rootPassword" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContainerCredential_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ContainerCredential_containerId_key" ON "ContainerCredential"("containerId");

-- CreateIndex
CREATE INDEX "ContainerCredential_userId_idx" ON "ContainerCredential"("userId");
