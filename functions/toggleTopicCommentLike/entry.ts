import { createClientFromRequest } from "npm:@base44/sdk@0.8.52";

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

    const commentId = String(payload.commentId || "").trim();
    if (!commentId) return Response.json({ error: "Missing commentId" }, { status: 400 });

    const comment = await base44.asServiceRole.entities.TopicComment.get(commentId);
    const likes = Array.isArray(comment.likes) ? comment.likes : [];
    const liked = likes.includes(user.id);
    const next = liked ? likes.filter((id) => id !== user.id) : [...likes, user.id];

    await base44.asServiceRole.entities.TopicComment.update(commentId, { likes: next });

    return Response.json({ liked: !liked, likeCount: next.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}