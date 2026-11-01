// Shared profanity filter used by postTeamComment, postTopic, and postTopicComment.
// Matched against whole tokens after light leet/obfuscation normalization,
// so ordinary words like "class" or "pass" are never flagged.

const BANNED = new Set([
  "fuck", "fucker", "fucking", "fuckin", "motherfucker", "motherfucking",
  "shit", "shitty", "bullshit", "dipshit",
  "bitch", "bitches", "bitching",
  "bastard",
  "dick", "dickhead", "dickless",
  "pussy",
  "cunt",
  "cock", "cocksucker", "cocksucking",
  "asshole", "assholes", "arsehole",
  "twat",
  "wanker",
  "slut", "sluts",
  "whore", "whores",
  "faggot", "fag", "fags",
  "nigger", "nigga", "niggers",
  "spic",
  "kike",
  "chink",
  "retard", "retarded",
  "douche", "douchebag",
  "jerkoff",
  "skank"
]);

function normalize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/@/g, "a")
    .replace(/\$/g, "s")
    .replace(/0/g, "o")
    .replace(/1/g, "i")
    .replace(/3/g, "e")
    .replace(/4/g, "a")
    .replace(/7/g, "t")
    .replace(/!/g, "i")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

export function findProfanity(text: string): string | null {
  for (const token of normalize(text)) {
    if (BANNED.has(token)) return token;
  }
  return null;
}