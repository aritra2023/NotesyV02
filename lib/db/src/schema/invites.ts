import { pgTable, text, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const invitesTable = pgTable("invites", {
  token: text("token").primaryKey(),
  subjectName: text("subject_name").notNull(),
  sessionTitle: text("session_title").notNull(),
  sessionId: text("session_id").notNull(),
  messages: jsonb("messages").notNull().default([]),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertInviteSchema = createInsertSchema(invitesTable).omit({ createdAt: true });
export type InsertInvite = z.infer<typeof insertInviteSchema>;
export type Invite = typeof invitesTable.$inferSelect;
