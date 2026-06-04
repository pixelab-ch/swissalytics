/**
 * Serialize a JSON-LD object for safe inlining in <script type="application/ld+json">.
 * JSON.stringify does NOT escape `<`, U+2028 or U+2029 — a literal `</script>` (or those
 * line separators) in any field would break out of the script tag. Use this everywhere a
 * JSON-LD blob is injected via dangerouslySetInnerHTML.
 * Uses String.fromCharCode to avoid embedding the (invisible) line separators in source.
 */
export function serializeJsonLd(obj: unknown): string {
  const LS = String.fromCharCode(0x2028);
  const PS = String.fromCharCode(0x2029);
  return JSON.stringify(obj)
    .split('<')
    .join('\\u003c')
    .split(LS)
    .join('\\u2028')
    .split(PS)
    .join('\\u2029');
}
