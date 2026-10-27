// Institutional Confidentiality & Financial Identifier Redaction
// Used for LP/VC/PE deal workspaces, data rooms, and diligence pipelines.

export interface FinancialIdentifierMatch {
  type: "ssn" | "routing" | "account" | "credit_card" | "phone";
  label: string;
  match: string;
  index: number;
}

export const REDACTION_LABELS = {
  ssn: "«redacted SSN»",
  routing: "«redacted Wire Routing»",
  account: "«redacted Bank Account»",
  credit_card: "«redacted Credit Card»",
  phone: "«redacted Phone Number»",
} as const;

// 1. SSN: US Social Security Numbers and ITINs (e.g. 123-45-6789 or labeled)
const SSN_STANDARD = /\b(?!000)\d{3}-(?!00)\d{2}-(?!0000)\d{4}\b/g;
const SSN_LABELED = /(?:\b(?:SSN|Social\s+Security(?:\s+Number)?)[\s#:=-]+)(\d{3}[-\s]?\d{2}[-\s]?\d{4})\b/gi;

// 2. Wire / ABA Routing: 9-digit transit routing numbers, usually labeled
const ROUTING_LABELED = /(?:\b(?:ABA|routing|rtn|transit|wire\s+routing)(?:\s*(?:#|number|no\.?|code)?)?[\s#:=-]+)([0-9]{9})\b/gi;

// 3. Bank Account Numbers: 8-17 digits, labeled or IBAN
const ACCOUNT_LABELED = /(?:\b(?:acct|account|bank\s+account|checking(?:\s+acct)?|savings(?:\s+acct)?|dda)(?:\s*(?:#|number|no\.?|id)?)?[\s#:=-]+)([0-9]{8,17})\b/gi;
const IBAN_PATTERN = /\b[A-Z]{2}[0-9]{2}[A-Z0-9]{4}[0-9]{7}(?:[A-Z0-9]{0,16})\b/g;

// 4. Credit / Debit Card Numbers (Visa, MasterCard, Amex, Discover, etc.)
const CC_FORMATTED = /\b(?:\d{4}[-\s]\d{4}[-\s]\d{4}[-\s]\d{4}|3[47]\d{2}[-\s]\d{6}[-\s]\d{5})\b/g;
const CC_LABELED = /(?:\b(?:credit\s*card|debit\s*card|card)(?:\s*(?:#|number|no\.?))?[\s#:=-]+)([0-9\s-]{13,19})\b/gi;
const CC_STANDARD = /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|6(?:011|5[0-9]{2})[0-9]{12})\b/g;

// 5. Personal Phone Numbers: US and North American 10-digit formats with separators
const PHONE_PATTERN = /\b(?:\+?1[-.\s]?)?\(?[2-9]\d{2}\)?[-.\s]?[2-9]\d{2}[-.\s]?\d{4}\b/g;

export function findFinancialIdentifiers(text: string): FinancialIdentifierMatch[] {
  if (!text || typeof text !== "string") return [];
  const matches: FinancialIdentifierMatch[] = [];

  const addMatches = (
    regex: RegExp,
    type: FinancialIdentifierMatch["type"],
    label: string,
    captureGroupIndex = 0,
  ) => {
    const re = new RegExp(regex.source, regex.flags);
    let match: RegExpExecArray | null;
    while ((match = re.exec(text)) !== null) {
      const matchedStr = captureGroupIndex > 0 && match[captureGroupIndex] ? match[captureGroupIndex] : match[0];
      const matchIndex = captureGroupIndex > 0 && match[captureGroupIndex]
        ? match.index + match[0].indexOf(match[captureGroupIndex])
        : match.index;
      // Skip if already matched an overlapping span or if it's already a redacted token
      if (matchedStr.startsWith("«redacted")) continue;
      matches.push({
        type,
        label,
        match: matchedStr,
        index: matchIndex,
      });
    }
  };

  // SSNs
  addMatches(SSN_STANDARD, "ssn", REDACTION_LABELS.ssn);
  addMatches(SSN_LABELED, "ssn", REDACTION_LABELS.ssn, 1);

  // Routing
  addMatches(ROUTING_LABELED, "routing", REDACTION_LABELS.routing, 1);

  // Bank Accounts
  addMatches(ACCOUNT_LABELED, "account", REDACTION_LABELS.account, 1);
  addMatches(IBAN_PATTERN, "account", REDACTION_LABELS.account);

  // Credit Cards
  addMatches(CC_FORMATTED, "credit_card", REDACTION_LABELS.credit_card);
  addMatches(CC_LABELED, "credit_card", REDACTION_LABELS.credit_card, 1);
  addMatches(CC_STANDARD, "credit_card", REDACTION_LABELS.credit_card);

  // Phone Numbers (evaluated after CC and SSN to avoid overlapping card/SSN formats)
  addMatches(PHONE_PATTERN, "phone", REDACTION_LABELS.phone);

  // Sort by index ascending
  return matches.sort((a, b) => a.index - b.index);
}

export function containsFinancialIdentifiers(text: string): boolean {
  if (!text) return false;
  return findFinancialIdentifiers(text).length > 0;
}

export function redactFinancialIdentifiers(text: string): string {
  if (!text || typeof text !== "string") return text;
  let result = text;

  // 1. SSNs
  result = result.replace(SSN_LABELED, (full, ssnVal) => full.replace(ssnVal, REDACTION_LABELS.ssn));
  result = result.replace(SSN_STANDARD, REDACTION_LABELS.ssn);

  // 2. Wire Routing
  result = result.replace(ROUTING_LABELED, (full, val) => full.replace(val, REDACTION_LABELS.routing));

  // 3. Bank Accounts
  result = result.replace(ACCOUNT_LABELED, (full, val) => full.replace(val, REDACTION_LABELS.account));
  result = result.replace(IBAN_PATTERN, REDACTION_LABELS.account);

  // 4. Credit Cards
  result = result.replace(CC_LABELED, (full, val) => full.replace(val, REDACTION_LABELS.credit_card));
  result = result.replace(CC_FORMATTED, REDACTION_LABELS.credit_card);
  result = result.replace(CC_STANDARD, REDACTION_LABELS.credit_card);

  // 5. Phone Numbers
  result = result.replace(PHONE_PATTERN, REDACTION_LABELS.phone);

  return result;
}

export interface ConfidentialPromptFilterResult {
  prompt: string;
  redacted: boolean;
  warnings: string[];
}

export function confidentialModePromptFilter(
  prompt: string,
  enabled: boolean,
): ConfidentialPromptFilterResult {
  if (!enabled || !prompt) {
    return { prompt, redacted: false, warnings: [] };
  }

  const items = findFinancialIdentifiers(prompt);
  if (items.length === 0) {
    return { prompt, redacted: false, warnings: [] };
  }

  const counts: Record<string, number> = {};
  for (const item of items) {
    counts[item.type] = (counts[item.type] || 0) + 1;
  }

  const warnings: string[] = [];
  if (counts.ssn) warnings.push(`Redacted ${counts.ssn} Social Security Number(s)`);
  if (counts.routing) warnings.push(`Redacted ${counts.routing} Wire Routing Number(s)`);
  if (counts.account) warnings.push(`Redacted ${counts.account} Bank Account Number(s)`);
  if (counts.credit_card) warnings.push(`Redacted ${counts.credit_card} Credit Card Number(s)`);
  if (counts.phone) warnings.push(`Redacted ${counts.phone} Phone Number(s)`);

  const redactedText = redactFinancialIdentifiers(prompt);
  return {
    prompt: redactedText,
    redacted: true,
    warnings,
  };
}
