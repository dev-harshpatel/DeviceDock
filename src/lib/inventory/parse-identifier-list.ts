/**
 * Splits pasted or spreadsheet cell text into individual identifier tokens.
 * Matches Add Product / Add Multiple flows (comma, newline, tab, semicolon).
 */
export const parseIdentifierList = (rawValue: string): string[] => {
  return rawValue
    .split(/[,\n\r\t;]+/)
    .map((value) => value.trim())
    .filter(Boolean);
};
