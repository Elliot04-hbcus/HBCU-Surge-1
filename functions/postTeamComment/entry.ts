import { createClientFromRequest } from "npm:@base44/sdk@0.8.52";
import { findProfanity } from "../../shared/profanityFilter.ts";

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    let payload;
    try {
      payload = await req.json();
    } catch {
      return Response.json({ error: "Invalid request body" }, { status: 400 });
    }

    const team_id = String(payload.team_id || "").trim();
    const body = String(payload.body || "").trim();
    const sport = payload.sport === "basketball" ? "basketball" : "football";
    const parent_id = payload.parent_id ? String(payload.parent_id).trim() : "";

    if (!team_id) return Response.json({ error: "Missing team" }, { status: 400 });
    if (!body) return Response.json({ error: "Comment cannot be empty" }, { status: 400 });
    if (body.length > 500) return Response.json({ error: "Comment is too long" }, { status: 400 });

    const bad = findProfanity(body);
    if (bad) {
      return Response.json(
        { error: "Profanity is not allowed. Please keep the conversation respectful." },
        { status: 400 }
      );
    }

    const created = await base44.asServiceRole.entities.TeamComment.create({
      team_id,
      sport,
      body,
      author_name: user.full_name || user.email || "Fan",
      author_id: user.id,
      parent_id,
    });

    return Response.json(created);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}