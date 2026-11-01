import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useSport } from "@/components/SportContext";
import TeamLogo from "@/components/TeamLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { User, Loader2, Check, Lock, ArrowLeft } from "lucide-react";

export default function Profile() {
  const navigate = useNavigate();
  const { sport } = useSport();
  const qc = useQueryClient();

  const me = useQuery({ queryKey: ["me"], queryFn: () => base44.auth.me() });
  const teams = useQuery({
    queryKey: ["standings", sport],
    queryFn: () => base44.functions.invoke("getHbcuStandings", { sport }).then((r) => r.data),
  });

  const [savingLogo, setSavingLogo] = useState(false);
  const [logoError, setLogoError] = useState("");

  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwBusy, setPwBusy] = useState(false);
  const [pwError, setPwError] = useState("");
  const [pwSuccess, setPwSuccess] = useState(false);

  const user = me.data;
  const teamList = (teams.data?.teams || []).filter((t) => t.logo);

  async function pickLogo(logo) {
    if (user?.profile_logo === logo) return;
    setSavingLogo(true);
    setLogoError("");
    try {
      await base44.auth.updateMe({ profile_logo: logo });
      qc.invalidateQueries({ queryKey: ["me"] });
    } catch (err) {
      setLogoError(err.message || "Could not update profile picture");
    } finally {
      setSavingLogo(false);
    }
  }

  async function changePassword(e) {
    e.preventDefault();
    setPwError("");
    setPwSuccess(false);
    if (newPw.length < 6) {
      setPwError("New password must be at least 6 characters");
      return;
    }
    if (newPw !== confirmPw) {
      setPwError("New passwords do not match");
      return;
    }
    setPwBusy(true);
    try {
      await base44.auth.changePassword({
        userId: user.id,
        currentPassword: currentPw,
        newPassword: newPw,
      });
      setPwSuccess(true);
      setCurrentPw("");
      setNewPw("");
      setConfirmPw("");
    } catch (err) {
      setPwError(err.response?.data?.error || err.message || "Could not change password");
    } finally {
      setPwBusy(false);
    }
  }

  return (
    <div className="space-y-8 max-w-2xl">
      <button
        type="button"
        onClick={() =>
          window.history.state && window.history.state.idx > 0 ? navigate(-1) : navigate("/")
        }
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-full border border-border bg-muted flex items-center justify-center overflow-hidden">
          {user?.profile_logo ? (
            <TeamLogo src={user.profile_logo} alt="Profile" className="w-full h-full" />
          ) : (
            <User className="w-6 h-6 text-muted-foreground" />
          )}
        </div>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold truncate">{user?.full_name || "Your profile"}</h1>
          <p className="text-sm text-muted-foreground truncate">{user?.email}</p>
        </div>
      </div>

      <section className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div>
          <h2 className="font-semibold">Profile picture</h2>
          <p className="text-sm text-muted-foreground">
            Pick an HBCU team logo as your profile picture.
          </p>
        </div>
        {logoError && <p className="text-xs text-destructive">{logoError}</p>}
        {teams.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading teams…</p>
        ) : (
          <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
            {teamList.map((t) => {
              const selected = user?.profile_logo === t.logo;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => pickLogo(t.logo)}
                  disabled={savingLogo}
                  className={`relative flex flex-col items-center gap-1 rounded-lg border p-2 transition ${
                    selected ? "border-primary bg-primary/5" : "border-border hover:bg-muted"
                  }`}
                  title={t.name}
                >
                  <TeamLogo src={t.logo} alt={t.name} className="w-8 h-8" />
                  {selected && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                      <Check className="w-2.5 h-2.5" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
        {savingLogo && <p className="text-xs text-muted-foreground">Saving…</p>}
      </section>

      <section className="rounded-xl border border-border bg-card p-4 space-y-2">
        <h2 className="font-semibold">Account details</h2>
        <p className="text-sm text-muted-foreground">
          Your name and email are set when you sign up and can't be changed here.
        </p>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs text-muted-foreground">Name</Label>
            <p className="text-sm font-medium">{user?.full_name || "—"}</p>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Email</Label>
            <p className="text-sm font-medium truncate">{user?.email || "—"}</p>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Lock className="w-4 h-4 text-muted-foreground" />
          <h2 className="font-semibold">Change password</h2>
        </div>
        <form onSubmit={changePassword} className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="currentPw">Current password</Label>
            <Input
              id="currentPw"
              type="password"
              value={currentPw}
              onChange={(e) => setCurrentPw(e.target.value)}
              required
            />
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="newPw">New password</Label>
              <Input
                id="newPw"
                type="password"
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="confirmPw">Confirm new password</Label>
              <Input
                id="confirmPw"
                type="password"
                value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
                required
              />
            </div>
          </div>
          {pwError && <p className="text-xs text-destructive">{pwError}</p>}
          {pwSuccess && <p className="text-xs text-green-600">Password updated.</p>}
          <Button type="submit" disabled={pwBusy}>
            {pwBusy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Update password
          </Button>
        </form>
      </section>
    </div>
  );
}