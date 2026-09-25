-- AlterTable
ALTER TABLE "contacts" ADD COLUMN "follow_up_sent_at" DATETIME;
ALTER TABLE "contacts" ADD COLUMN "last_interaction_at" DATETIME;
ALTER TABLE "contacts" ADD COLUMN "memory_notes" TEXT;

-- AlterTable
ALTER TABLE "products" ADD COLUMN "photo_url" TEXT;

-- CreateTable
CREATE TABLE "prompt_variants" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "product_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description_text" TEXT NOT NULL,
    "weight" INTEGER NOT NULL DEFAULT 1,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "prompt_variants_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "conversation_products" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversation_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "added_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "conversation_products_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "conversation_products_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "unanswered_topics" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversation_id" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "unanswered_topics_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_conversations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "contact_id" TEXT NOT NULL,
    "product_id" TEXT,
    "prompt_variant_id" TEXT,
    "state" TEXT NOT NULL DEFAULT 'active',
    "needs_human" BOOLEAN NOT NULL DEFAULT false,
    "escalated_at" DATETIME,
    "escalation_reason" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "conversations_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "conversations_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "conversations_prompt_variant_id_fkey" FOREIGN KEY ("prompt_variant_id") REFERENCES "prompt_variants" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_conversations" ("contact_id", "created_at", "escalated_at", "escalation_reason", "id", "needs_human", "product_id", "state", "updated_at") SELECT "contact_id", "created_at", "escalated_at", "escalation_reason", "id", "needs_human", "product_id", "state", "updated_at" FROM "conversations";
DROP TABLE "conversations";
ALTER TABLE "new_conversations" RENAME TO "conversations";
CREATE INDEX "conversations_contact_id_idx" ON "conversations"("contact_id");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "prompt_variants_product_id_idx" ON "prompt_variants"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "conversation_products_conversation_id_product_id_key" ON "conversation_products"("conversation_id", "product_id");

-- CreateIndex
CREATE INDEX "unanswered_topics_conversation_id_idx" ON "unanswered_topics"("conversation_id");
