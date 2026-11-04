// Treat name/roll-number filters as literal text, not regex programs.
export function literalSearch(value: string): string {
  if (typeof value !== "string" || value.length > 200) {
    throw { statusCode: 400, message: "Search must be text of at most 200 characters." };
  }
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
