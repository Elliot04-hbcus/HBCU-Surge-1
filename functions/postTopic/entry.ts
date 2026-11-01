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

    const title = String(payload.title || "").trim();
    const body = String(payload.body || "").trim();
    const sport = payload.sport === "basketball" ? "basketball" : "football";

    if (!title) return Response.json({ error: "Title is required" }, { status: 400 });
    if (title.length > 200) return Response.json({ error: "Title is too long" }, { status: 400 });
    if (body.length > 2000) return Response.json({ error: "Description is too long" }, { status: 400 });

    const bad = findProfanity(title) || (body && findProfanity(body));
    if (bad) {
      return Response.json(
        { error: "Profanity is not allowed. Please keep the conversation respectful." },
        { status: 400 }
      );
    }

    const created = await base44.asServiceRole.entities.Topic.create({
      title,
      body,
      sport,
      author_name: user.full_name || user.email || "Fan",
      author_id: user.id,
    });

    return Response.json(created);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}