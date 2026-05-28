ALTER TABLE "User" ADD COLUMN "role" TEXT NOT NULL DEFAULT 'user';

UPDATE "User"
SET "role" = CASE WHEN "isAdmin" = true THEN 'owner' ELSE 'user' END;

CREATE TABLE "BehaviorLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "username" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BehaviorLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "BehaviorLog_userId_createdAt_idx" ON "BehaviorLog"("userId", "createdAt");
CREATE INDEX "BehaviorLog_createdAt_idx" ON "BehaviorLog"("createdAt");
