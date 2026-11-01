import { createClientFromRequest } from "npm:@base44/sdk@0.8.52";

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const uid = user.id;

    // Remove the user's own content across the app.
    await base44.asServiceRole.entities.FavoriteTeam.deleteMany({ created_by_id: uid });
    await base44.asServiceRole.entities.TeamComment.deleteMany({ created_by_id: uid });
    await base44.asServiceRole.entities.MyRanking.deleteMany({ created_by_id: uid });

    // Attempt to delete the login account itself.
    try {
      await base44.asServiceRole.entities.User.delete(uid);
    } catch (e) {
      return Response.json(
        {
          error:
            "Your content was removed, but the platform would not delete the login account. Please contact support to fully close your account.",
        },
        { status: 500 }
      );
    }

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}