// Turns text typed in a search box into a safe, case-insensitive regular expression.
// Characters such as ( [ * + ? are matched literally, so a search can never break the
// query or slow the database down with a crafted pattern.
export const escapeRegex = (text) => String(text ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const searchRegex = (text) => new RegExp(escapeRegex(String(text ?? '').trim().slice(0, 100)), 'i');
