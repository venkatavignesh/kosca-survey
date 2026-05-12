export function renderTemplate(
  template: string,
  vars: Record<string, string | number | undefined | null>,
): string {
  // Mustache-style sections: {{#var}}...{{/var}} renders the inner block only
  // when `var` is truthy. Used by admins to conditionalize copy on optional
  // fields like {{deadline}}. Keep section handling BEFORE plain substitution
  // so that a section's body can contain its own {{var}} placeholders.
  const sectionPat = /\{\{\s*#\s*([a-zA-Z0-9_]+)\s*\}\}([\s\S]*?)\{\{\s*\/\s*\1\s*\}\}/g;
  let out = template;
  // Loop in case sections nest; each pass strips one level.
  let prev: string;
  do {
    prev = out;
    out = out.replace(sectionPat, (_m, key: string, inner: string) => {
      const v = vars[key];
      return v == null || v === '' ? '' : inner;
    });
  } while (out !== prev);
  return out.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_m, key: string) => {
    const v = vars[key];
    return v == null ? '' : String(v);
  });
}
