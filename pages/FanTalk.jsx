import React, { useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { MessageSquare, Plus, ArrowLeft, Heart, Send, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSport } from "@/components/SportContext";
import TopicCommentSection from "@/components/TopicCommentSection";
import PullToRefresh from "@/components/PullToRefresh";
import MobileSelect from "@/components/MobileSelect";

export default function FanTalk() {
  const qc = useQueryClient();
  const { sport: currentSport } = useSport();
  const { topicId } = useParams();
  const navigate = useNavigate();
  const [showNewTopic, setShowNewTopic] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [topicSport, setTopicSport] = useState(currentSport);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const me = useQuery({ queryKey: ["me"], queryFn: () => base44.auth.me() });
  const topics = useQuery({
    queryKey: ["topics"],
    queryFn: () =>
      base44.entities.Topic.filter({}, { sort: "-created_date", limit: 50 }).then((r) => r.items || []),
  });

  const selectedTopic = topicId
    ? (topics.data || []).find((t) => t.id === topicId)
    : null;

  async function createTopic(e) {
    e.preventDefault();
    const t = title.trim();
    if (!t) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await base44.functions.invoke("postTopic", {
        title: t,
        body: body.trim(),
        sport: topicSport,
      });
      if (res.status >= 400) {
        setError(res.data?.error || "Could not create topic");
      } else {
        setTitle("");
        setBody("");
        setShowNewTopic(false);
        qc.invalidateQueries({ queryKey: ["topics"] });
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Could not create topic");
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteTopic(id) {
    const prev = qc.getQueryData(["topics"]) || [];
    qc.setQueryData(["topics"], prev.filter((t) => t.id !== id));
    try {
      await base44.entities.Topic.delete(id);
      navigate('/fan-talk', { replace: true });
    } catch (e) {
      qc.setQueryData(["topics"], prev);
    }
    qc.invalidateQueries({ queryKey: ["topics"] });
  }

  async function toggleTopicLike(id) {
    const prev = qc.getQueryData(["topics"]) || [];
    const uid = me.data?.id;
    if (!uid) return;
    const updated = prev.map((t) => {
      if (t.id !== id) return t;
      const likes = Array.isArray(t.likes) ? t.likes : [];
      const liked = likes.includes(uid);
      return { ...t, likes: liked ? likes.filter((x) => x !== uid) : [...likes, uid] };
    });
    qc.setQueryData(["topics"], updated);
    try {
      await base44.functions.invoke("toggleTopicLike", { topicId: id });
    } catch (e) {
      qc.setQueryData(["topics"], prev);
    }
    qc.invalidateQueries({ queryKey: ["topics"] });
  }

  // Topic detail view
  if (topicId) {
    if (topics.isLoading) return <p className="text-muted-foreground">Loading topic…</p>;
    if (!selectedTopic) {
      return (
        <div className="space-y-4">
          <button
            onClick={() => navigate('/fan-talk')}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-4 h-4" /> Back to topics
          </button>
          <p className="text-muted-foreground">Topic not found.</p>
        </div>
      );
    }
    const mine =
      me.data && (selectedTopic.author_id === me.data.id || selectedTopic.created_by_id === me.data.id);
    const isAdmin = me.data?.role === "admin";
    const likes = Array.isArray(selectedTopic.likes) ? selectedTopic.likes : [];
    const liked = me.data && likes.includes(me.data.id);

    return (
      <div className="space-y-4">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4" /> Back to topics
        </button>

        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-start justify-between gap-2">
            <h1 className="text-xl font-bold">{selectedTopic.title}</h1>
            {selectedTopic.sport && (
              <span className="text-xs bg-muted rounded-full px-2.5 py-1 capitalize shrink-0">
                {selectedTopic.sport}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
            <div className="w-6 h-6 rounded-full bg-brand/15 text-brand flex items-center justify-center text-xs font-bold">
              {(selectedTopic.author_name || "F").charAt(0).toUpperCase()}
            </div>
            <span className="font-medium text-foreground/80">
              {selectedTopic.author_name || "Anonymous Fan"}
            </span>
            <span>·</span>
            <span>
              {new Date(selectedTopic.created_date).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })}
            </span>
          </div>
          {selectedTopic.body && (
            <p className="mt-3 text-foreground/90 whitespace-pre-wrap break-words">{selectedTopic.body}</p>
          )}
          <div className="mt-3 flex items-center gap-3">
            <button
              onClick={() => toggleTopicLike(selectedTopic.id)}
              className={cn(
                "inline-flex items-center gap-1.5 text-sm transition",
                liked ? "text-brand" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Heart className="w-4 h-4" fill={liked ? "currentColor" : "none"} />
              {likes.length > 0 && <span>{likes.length}</span>}
              {likes.length === 0 && <span>Like</span>}
            </button>
            {(mine || isAdmin) && (
              <button
                onClick={() => deleteTopic(selectedTopic.id)}
                className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="w-4 h-4" /> Delete
              </button>
            )}
          </div>
        </div>

        <TopicCommentSection topicId={selectedTopic.id} />
      </div>
    );
  }

  // Topic list view
  return (
    <PullToRefresh onRefresh={topics.refetch}>
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-brand" />
          <h1 className="text-xl font-bold">Fan Talk</h1>
        </div>
        {me.data && (
          <button
            onClick={() => setShowNewTopic(!showNewTopic)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground px-3 py-2 text-sm font-medium hover:opacity-90 transition"
          >
            {showNewTopic ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {showNewTopic ? "Cancel" : "New Topic"}
          </button>
        )}
      </div>

      {showNewTopic && me.data && (
        <form onSubmit={createTopic} className="rounded-xl border border-border bg-card p-4 space-y-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Topic title…"
            maxLength={200}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Add details (optional)…"
            rows={3}
            maxLength={2000}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
          />
          <div className="flex items-center gap-2">
            <MobileSelect
              value={topicSport}
              onValueChange={setTopicSport}
              options={[{ value: "football", label: "Football" }, { value: "basketball", label: "Basketball" }]}
              triggerClassName="w-[130px]"
            />
            <button
              type="submit"
              disabled={submitting || !title.trim()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:opacity-90 transition disabled:opacity-50"
            >
              <Send className="w-4 h-4" /> Post Topic
            </button>
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </form>
      )}

      {!me.data && (
        <div className="rounded-xl border border-dashed border-border p-4 text-center">
          <p className="text-sm text-muted-foreground">
            <Link to="/login" className="text-primary font-medium hover:underline">
              Sign in
            </Link>{" "}
            to create topics and join the conversation.
          </p>
        </div>
      )}

      {topics.isLoading ? (
        <p className="text-muted-foreground">Loading topics…</p>
      ) : (topics.data || []).length === 0 ? (
        <p className="text-muted-foreground py-8 text-center rounded-xl border border-dashed border-border">
          No topics yet. {me.data ? "Start the conversation!" : "Be the first to post once you sign in!"}
        </p>
      ) : (
        <div className="space-y-2">
          {(topics.data || []).map((t) => {
            const likes = Array.isArray(t.likes) ? t.likes : [];
            return (
              <button
                key={t.id}
                onClick={() => navigate('/fan-talk/' + t.id)}
                className="w-full text-left rounded-xl border border-border bg-card p-4 hover:bg-muted/30 transition"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold">{t.title}</h3>
                  {t.sport && (
                    <span className="text-xs bg-muted rounded-full px-2 py-0.5 capitalize shrink-0">
                      {t.sport}
                    </span>
                  )}
                </div>
                {t.body && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{t.body}</p>}
                <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground/70">{t.author_name || "Fan"}</span>
                  <span>·</span>
                  <span>
                    {new Date(t.created_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </span>
                  {likes.length > 0 && (
                    <>
                      <span>·</span>
                      <span className="inline-flex items-center gap-0.5">
                        <Heart className="w-3 h-3" fill="currentColor" /> {likes.length}
                      </span>
                    </>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
    </PullToRefresh>
  );
}