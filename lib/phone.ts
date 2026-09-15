/**
 * Bangladeshi mobile number helpers.
 *
 * Canonical storage form: 8801XXXXXXXXX (13 digits, no plus sign).
 * Display form:           01XXXXXXXXX   (11 digits).
 *
 * Never parse a phone number anywhere else — always go through these.
 */

const BENGALI_DIGITS = "০১২৩৪৫৬৭৮৯";

/** Convert Bengali numerals to ASCII digits and drop everything that is not a digit. */
function digitsOnly(input: string): string {
  let out = "";
  for (const ch of input) {
    const bn = BENGALI_DIGITS.indexOf(ch);
    if (bn !== -1) {
      out += String(bn);
    } else if (ch >= "0" && ch <= "9") {
      out += ch;
    }
  }
  return out;
}

/**
 * Normalise any reasonable way of writing a BD mobile number to 8801XXXXXXXXX.
 *
 * Accepts: 01XXXXXXXXX, 1XXXXXXXXX, 8801XXXXXXXXX, +8801XXXXXXXXX, 008801XXXXXXXXX,
 * with any spaces, dashes or brackets, and with Bengali or Western numerals.
 *
 * Returns null if the input is not a valid BD mobile number
 * (operator prefixes 013–019 only).
 */
export function normalizeBD(input: string | null | undefined): string | null {
  if (!input) return null;

  let d = digitsOnly(input);

  if (d.startsWith("00")) d = d.slice(2); // international 00 prefix
  if (d.startsWith("880")) d = d.slice(3);
  if (d.startsWith("0")) d = d.slice(1);

  // Now expect the 10-digit national number: 1[3-9]XXXXXXXX
  if (!/^1[3-9]\d{8}$/.test(d)) return null;

  return `880${d}`;
}

/** Canonical 8801XXXXXXXXX → 01XXXXXXXXX for display. Falls back to the input if it can't be normalised. */
export function displayBD(phone: string | null | undefined): string {
  const canonical = normalizeBD(phone);
  if (!canonical) return phone ?? "";
  return `0${canonical.slice(3)}`;
}

/**
 * Turn a partial phone number typed into a search box into a canonical-form
 * prefix, so "017", "+880 17", "০১৭" and "88017" all match 88017…
 * Returns null when the input has no digits or does not look like a BD number.
 */
export function phoneSearchPrefix(input: string | null | undefined): string | null {
  if (!input) return null;
  let d = digitsOnly(input);
  if (!d) return null;

  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("880")) return d.length > 3 ? d : null;
  if (d.startsWith("0")) return d.length > 1 ? `88${d}` : null;
  if (d.startsWith("1")) return `880${d}`;
  return null;
}

/** WhatsApp deep link for a BD number, or null if the number is invalid. */
export function waLink(phone: string | null | undefined): string | null {
  const canonical = normalizeBD(phone);
  if (!canonical) return null;
  return `https://wa.me/${canonical}`;
}
