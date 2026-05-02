import { Router } from "express";
import { randomBytes } from "crypto";
import { db, invitesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { CreateInviteBody, GetInviteParams } from "@workspace/api-zod";

const router = Router();

router.post("/invite", async (req, res) => {
  const parsed = CreateInviteBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { subjectName, sessionTitle, sessionId, messages, createdBy } = parsed.data;
  const token = randomBytes(16).toString("hex");

  try {
    await db.insert(invitesTable).values({
      token,
      subjectName,
      sessionTitle,
      sessionId,
      messages: messages ?? [],
      createdBy: createdBy ?? null,
    });

    const domains = process.env.REPLIT_DOMAINS?.split(",")[0] || "localhost";
    const url = `https://${domains}/join/${token}`;

    res.json({ token, url });
  } catch (err) {
    req.log.error({ err }, "Failed to create invite");
    res.status(500).json({ error: "Failed to create invite" });
  }
});

router.get("/invite/:token", async (req, res) => {
  const parsed = GetInviteParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid token" });
    return;
  }

  const { token } = parsed.data;

  try {
    const invite = await db
      .select()
      .from(invitesTable)
      .where(eq(invitesTable.token, token))
      .limit(1);

    if (!invite.length) {
      res.status(404).json({ error: "Invite not found" });
      return;
    }

    const inv = invite[0];
    res.json({
      token: inv.token,
      subjectName: inv.subjectName,
      sessionTitle: inv.sessionTitle,
      sessionId: inv.sessionId,
      messages: inv.messages,
      createdBy: inv.createdBy,
      createdAt: inv.createdAt.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get invite");
    res.status(500).json({ error: "Failed to fetch invite" });
  }
});

export default router;
