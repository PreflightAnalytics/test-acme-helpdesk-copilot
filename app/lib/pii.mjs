// Masks what must never reach a model provider: email addresses, phone numbers, card
// numbers and IBANs. Order numbers (four digits) stay, since the copilot needs them.
const RULES = [
  { kind: 'email', pattern: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g },
  { kind: 'iban', pattern: /\b[A-Z]{2}\d{2}(?:\s?[A-Z0-9]{4}){3,7}(?:\s?[A-Z0-9]{1,4})?\b/g },
  { kind: 'card', pattern: /\b(?:\d[ -]?){13,19}\b/g },
  { kind: 'phone', pattern: /(?:\+\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]?){2,4}\d{3,4}\b/g },
];

export const maskPii = (text) => {
  const found = new Set();
  let masked = String(text ?? '');
  for (const { kind, pattern } of RULES) {
    masked = masked.replace(pattern, (value) => {
      if (kind === 'phone' && value.replace(/\D/g, '').length < 9) return value;
      found.add(kind);
      return `[${kind}]`;
    });
  }
  return { text: masked, masked: [...found].sort() };
};
