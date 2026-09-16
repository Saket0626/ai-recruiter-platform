import { OUTREACH_DOC_EXPORT_URL } from "@/lib/bot/config";
import { parseSeenFromDocText } from "@/lib/bot/ledger";

export async function fetchOutreachDocText() {
  const response = await fetch(OUTREACH_DOC_EXPORT_URL, {
    redirect: "follow",
    headers: { "User-Agent": "ResearchReach/1.0 (personal outreach ledger)" },
  });
  if (!response.ok) {
    throw new Error(`Could not read the outreach Google Doc (${response.status}).`);
  }
  return response.text();
}

export async function seenFromOutreachDoc() {
  try {
    const text = await fetchOutreachDocText();
    return parseSeenFromDocText(text);
  } catch {
    return parseSeenFromDocText("");
  }
}
