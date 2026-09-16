/**
 * SMS segment counting.
 *
 * GSM-7 (plain Latin text): 160 chars in one segment, 153 per segment after.
 * UCS-2 (anything else, including all Bangla): 70 in one, 67 per segment after.
 * Characters in the GSM-7 extension table cost two septets.
 */

const GSM7_BASIC =
  "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?" +
  "¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà";
const GSM7_EXTENDED = "\f^{}\\[~]|€";

export type SmsEncoding = "gsm" | "ucs2";

/** Longest message a bulk send may carry per patient. Keeps a typo from costing a fortune. */
export const MAX_CAMPAIGN_SEGMENTS = 5;

export interface SmsAnalysis {
  encoding: SmsEncoding;
  /** Length in the units the encoding counts: septets for GSM, UTF-16 units for UCS-2. */
  length: number;
  segments: number;
  /** Characters left before the next segment is needed. */
  remaining: number;
}

export function analyzeSms(body: string): SmsAnalysis {
  let gsm = true;
  let septets = 0;
  for (const ch of body) {
    if (GSM7_BASIC.includes(ch)) septets += 1;
    else if (GSM7_EXTENDED.includes(ch)) septets += 2;
    else {
      gsm = false;
      break;
    }
  }

  if (gsm) {
    const segments = septets === 0 ? 1 : septets <= 160 ? 1 : Math.ceil(septets / 153);
    const capacity = segments === 1 ? 160 : segments * 153;
    return { encoding: "gsm", length: septets, segments, remaining: capacity - septets };
  }

  // UCS-2 counts UTF-16 code units; a Bangla conjunct is several of them.
  const units = body.length;
  const segments = units <= 70 ? 1 : Math.ceil(units / 67);
  const capacity = segments === 1 ? 70 : segments * 67;
  return { encoding: "ucs2", length: units, segments, remaining: capacity - units };
}

export function countSegments(body: string): number {
  return analyzeSms(body).segments;
}
