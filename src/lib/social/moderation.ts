// Automatic content screening. Three outcomes:
//   allow  - published immediately
//   review - hidden from everyone but the author until an admin approves
//   reject - never stored; the author is told which guideline it broke
// Media is screened on the device (see lib/nsfw.ts) before upload; media that
// arrives without a passed check is forced into review.
export type Verdict = { action: "allow" | "review" | "reject"; flags: string[]; reason?: string };

const rx = (words: string[]) => new RegExp(`(?<![a-z])(${words.join("|")})(?![a-z])`, "i");

const SEXUAL = rx(["porn\\w*", "nudes?", "nudity", "xxx", "sex(?:y|ting|ual)?", "onlyfans", "escorts?", "boobs?", "nsfw", "hentai", "camgirl\\w*", "blowjob", "dick", "pussy", "cock"]);
const ABUSE = rx(["fuck\\w*", "shit\\w*", "bitch\\w*", "asshole\\w*", "bastard\\w*", "cunt\\w*", "motherfucker\\w*", "wesi\\w*", "huth\\w*", "pakaya\\w*", "ponnaya\\w*", "punda\\w*"]);
const HATE_VIOLENCE = rx(["kill (?:you|him|her|them)", "i will (?:kill|hurt)", "bomb threat", "terrorist\\w*"]);
const SCAM = [
  /guarante+d\s+(returns?|profits?|income)/i,
  /(double|triple)\s+your\s+(money|investment|capital)/i,
  /risk[\s-]*free\s+(returns?|profits?|investment)/i,
  /\b\d{2,4}\s?%\s+(daily|weekly|per\s+day|per\s+week|a\s+day|a\s+week)\b/i,
  /(join|add)\s+(my|our|the)\s+(vip\s+)?(whats\s?app|telegram|signal)\s+(group|channel)/i,
  /(sure|100%|confirmed)\s+(shot|tip|profit|winner)/i,
  /insider\s+(tip|info|information|news)/i,
  /(send|transfer|deposit)\s+(money|rs\.?|lkr|usdt|btc).{0,40}(get|receive|earn)/i,
  /(forex|crypto|binary)\s+(signals?|trading)\s+(group|course|account\s+management)/i,
  /(pump|push)\s+(it|this|the\s+price)\b/i,
];
const INVITE_LINK = /(wa\.me|chat\.whatsapp\.com|t\.me\/|bit\.ly|tinyurl\.com|cutt\.ly|shorturl)/i;
const PHONE = /(?:\+94|0)\s?7\d[\s-]?\d{3}[\s-]?\d{4}/;

const normalise = (s: string) =>
  s.normalize("NFKC").toLowerCase()
    .replace(/[@4]/g, "a").replace(/[!1|]/g, "i").replace(/0/g, "o").replace(/3/g, "e").replace(/\$(?=[a-z])/g, "s").replace(/5(?=[a-z])/g, "s")
    .replace(/(.)\1{2,}/g, "$1$1");

export function moderateText(text: string): Verdict {
  const flags: string[] = [];
  const raw = text.trim();
  const n = normalise(raw);

  if (SEXUAL.test(n)) return { action: "reject", flags: ["sexual"], reason: "Sexual or adult content is not allowed on this platform." };
  if (HATE_VIOLENCE.test(n)) return { action: "reject", flags: ["violence"], reason: "Threats and violent content are not allowed." };
  if (ABUSE.test(n)) return { action: "reject", flags: ["abuse"], reason: "Please keep it professional - abusive language is not allowed." };

  // Checked on the raw text: the look-alike normalisation above rewrites digits.
  if (SCAM.some((r) => r.test(raw))) flags.push("scam-pattern");
  if (INVITE_LINK.test(raw)) flags.push("invite-link");
  if (PHONE.test(raw)) flags.push("phone-number");
  const letters = raw.replace(/[^A-Za-z]/g, "");
  if (letters.length > 24 && letters.replace(/[^A-Z]/g, "").length / letters.length > 0.8) flags.push("shouting");
  if ((raw.match(/\$[A-Za-z]{2,6}/g) || []).length > 6) flags.push("ticker-stuffing");
  if ((raw.match(/https?:\/\//g) || []).length > 2) flags.push("link-heavy");

  const hard = flags.includes("scam-pattern") && (flags.includes("invite-link") || flags.includes("phone-number"));
  if (hard) return { action: "reject", flags, reason: "This looks like an investment solicitation or scam, which is not allowed." };
  if (flags.some((f) => ["scam-pattern", "invite-link", "phone-number", "ticker-stuffing"].includes(f)))
    return { action: "review", flags, reason: "Your post is being reviewed before it is shown to others." };
  return { action: "allow", flags };
}

export const extractTickers = (text: string) =>
  [...new Set((text.match(/\$[A-Za-z]{2,6}(?:\.[A-Za-z])?/g) || []).map((t) => t.slice(1).toUpperCase()))].slice(0, 8);
export const extractTags = (text: string) =>
  [...new Set((text.match(/#[\p{L}\p{N}_]{2,30}/gu) || []).map((t) => t.slice(1).toLowerCase()))].slice(0, 8);
