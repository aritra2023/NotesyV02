import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const sharedMessagesTable = pgTable("shared_messages", {
  id: text("id").primaryKey(),
  sessionId: text("session_id").notNull(),
  clientId: text("client_id"),
  role: text("role").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type SharedMessage = typeof sharedMessagesTable.$inferSelect;
