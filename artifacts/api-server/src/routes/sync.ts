import { Router } from "express";
import { randomUUID } from "crypto";
import { db, sharedMessagesTable } from "@workspace/db";
import { eq, and, gt } from "drizzle-orm";

const router = Router();

// POST /api/sync/message — save a message for a shared session
router.post("/sync/message", async (req, res) => {
  const { sessionId, role, content, clientId } = req.body as {
    sessionId?: string;
    role?: string;
    content?: string;
    clientId?: string;
  };

  if (!sessionId || !role || !content) {
    res.status(400).json({ error: "sessionId, role and content required" });
    return;
  }

  const id = randomUUID();
  try {
    await db.insert(sharedMessagesTable).values({
      id,
      sessionId,
      role,
      content,
      clientId: clientId ?? null,
    });
    res.json({ id });
  } catch (err) {
    req.log.error({ err }, "Failed to save sync message");
    res.status(500).json({ error: "Failed to save message" });
  }
});

// GET /api/sync/messages/:sessionId?since=<ISO> — fetch messages for a session
router.get("/sync/messages/:sessionId", async (req, res) => {
  const { sessionId } = req.params;
  const sinceRaw = req.query.since as string | undefined;

  // Prevent browser/CDN caching so polling always gets fresh data
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  res.setHeader("Pragma", "no-cache");

  try {
    let rows;
    if (sinceRaw) {
      const since = new Date(sinceRaw);
      rows = await db
        .select()
        .from(sharedMessagesTable)
        .where(and(eq(sharedMessagesTable.sessionId, sessionId), gt(sharedMessagesTable.createdAt, since)))
        .orderBy(sharedMessagesTable.createdAt);
    } else {
      rows = await db
        .select()
        .from(sharedMessagesTable)
        .where(eq(sharedMessagesTable.sessionId, sessionId))
        .orderBy(sharedMessagesTable.createdAt);
    }
    res.json({ messages: rows.map((r) => ({ id: r.id, clientId: r.clientId, role: r.role, content: r.content, createdAt: r.createdAt.toISOString() })) });
  } catch (err) {
    req.log.error({ err }, "Failed to fetch sync messages");
    res.status(500).json({ error: "Failed to fetch messages" });
  }
});

export default router;
