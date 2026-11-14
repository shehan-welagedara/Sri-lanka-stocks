import { notFound } from "next/navigation";
import { site } from "@/config/site";
import { Card, PageHeader } from "@/components/ui";

type Doc = { title: string; updated: string; sections: { h: string; p?: string; list?: string[] }[] };
const N = site.name;

const DOCS: Record<string, Doc> = {
  guidelines: {
    title: "Community guidelines",
    updated: "November 2026",
    sections: [
      { h: "What this community is for", p: `${N} is a professional space for investors, listed companies, brokers, analysts and businesses to discuss the Sri Lankan market. Posts should be about investing, companies, the economy or business.` },
      { h: "Never allowed", list: [
        "Nudity, sexual or adult content of any kind, in text, images or video.",
        "Scams and solicitation: guaranteed returns, 'double your money' offers, paid signal groups, or requests to send money.",
        "Market manipulation: pump-and-dump schemes, coordinated buying or selling, spreading false rumours, or sharing inside information.",
        "Harassment, hate speech, threats, or abusive language towards any person or group.",
        "Impersonating a company, broker, regulator or another person.",
        "Spam, repeated posts, misleading links, and irrelevant advertising outside of promoted posts.",
        "Sharing other people's private information.",
      ] },
      { h: "Good practice", list: [
        "Say when you hold a position in a company you are discussing.",
        "Share your reasoning and sources. Opinions are welcome; present them as opinions.",
        "Use $cashtags (for example $JKH) so others can find your post.",
        "Nothing here is personal financial advice. Only licensed investment advisors may give advice.",
      ] },
      { h: "How we enforce these rules", list: [
        "Every post is screened automatically before it is published. Media is checked for nudity on your device before upload.",
        "Posts that look risky are held for human review and are visible only to the author until approved.",
        "Anyone can report a post. Posts reported by several people are hidden until reviewed.",
        "Each violation adds a strike to the account. Three strikes removes the ability to post.",
      ] },
      { h: "Promoted posts and verified accounts", p: "Promoted posts are always labelled 'Promoted' and must follow these same rules. A verified badge confirms identity only; it is not an endorsement of anything the account says." },
    ],
  },
  privacy: {
    title: "Privacy policy",
    updated: "November 2026",
    sections: [
      { h: "Summary", p: `${N} collects the minimum needed to run the service. We do not sell personal data. This policy is written to align with Sri Lanka's Personal Data Protection Act, No. 9 of 2022.` },
      { h: "What we collect", list: [
        "Account details you give us: display name, handle, bio and account type.",
        "Content you publish: posts, replies, media, likes, follows, bookmarks and reports.",
        "Usage signals: which posts were shown and for how long, used to rank the feed and measure reach.",
        "Lead details, only when you ask to be contacted by a stockbroker: name, mobile number and district.",
        "Technical data: a session cookie that keeps you signed in, and standard server logs.",
      ] },
      { h: "What stays on your device", p: "Your watchlist, portfolio holdings, price alerts and display preferences are stored in your browser or app and are not sent to our servers. Media is checked for nudity on your device; images that fail the check are never uploaded." },
      { h: "How we use data", list: [
        "To show and rank the feed, and recommend accounts and companies.",
        "To keep the platform safe: moderation, spam prevention and enforcing the guidelines.",
        "To show advertising and promoted posts. Ads are chosen from context (for example, the company you are viewing), not from a personal profile sold to third parties.",
        "To pass your lead details to a licensed partner stockbroker, only with your explicit consent each time.",
      ] },
      { h: "Sharing", p: "We share data with service providers that host the app and database, with partner stockbrokers when you consent, and with authorities when the law requires it. Public posts are visible to everyone." },
      { h: "Your rights", list: [
        "Access, correct or delete your account data.",
        "Withdraw consent for broker contact at any time.",
        "Delete any post you have made.",
        "Complain to the Data Protection Authority of Sri Lanka.",
      ] },
      { h: "Retention", p: "Account data is kept while your account is active. Removed posts are kept for up to 90 days for appeals and legal compliance, then deleted." },
      { h: "Children", p: `${N} is for people aged 18 and over.` },
    ],
  },
  disclaimer: {
    title: "Disclaimer",
    updated: "November 2026",
    sections: [
      { h: "Not investment advice", p: `${N} provides market information and a discussion platform. Nothing on it is investment, legal or tax advice, or a recommendation to buy or sell any security. Speak to a licensed investment advisor before making decisions.` },
      { h: "Market data", p: "Prices, indices and announcements are sourced from publicly available Colombo Stock Exchange data, are delayed, and may contain errors or gaps. Do not rely on them for trading. Always confirm prices with your stockbroker." },
      { h: "User content", p: "Posts are the opinions of their authors, who may hold positions in the companies they discuss. We do not verify the accuracy of user posts." },
      { h: "No trading", p: `${N} does not execute trades or hold client money. Shares are bought and sold only through stockbrokers licensed by the Securities and Exchange Commission of Sri Lanka.` },
      { h: "Calculations", p: "Portfolio values and technical indicators are estimates calculated from delayed data and exclude brokerage fees, taxes and dividends." },
    ],
  },
};

export function generateStaticParams() {
  return Object.keys(DOCS).map((doc) => ({ doc }));
}

export async function generateMetadata({ params }: { params: Promise<{ doc: string }> }) {
  return { title: DOCS[(await params).doc]?.title };
}

export default async function LegalPage({ params }: { params: Promise<{ doc: string }> }) {
  const doc = DOCS[(await params).doc];
  if (!doc) notFound();
  return (
    <div>
      <PageHeader back title={doc.title} subtitle={`Updated ${doc.updated}`} />
      <div className="px-4 pt-2 lg:px-0">
        <Card className="max-w-[720px] space-y-6 p-6">
          {doc.sections.map((s) => (
            <section key={s.h}>
              <h2 className="text-[17px] font-bold">{s.h}</h2>
              {s.p && <p className="mt-1.5 text-[15px] leading-relaxed">{s.p}</p>}
              {s.list && <ul className="mt-2 list-disc space-y-1.5 pl-5 text-[15px] leading-relaxed marker:text-muted">{s.list.map((l) => <li key={l}>{l}</li>)}</ul>}
            </section>
          ))}
        </Card>
      </div>
    </div>
  );
}
