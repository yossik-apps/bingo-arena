// Since 025, a new table, view, sequence or function gives the client roles nothing, so each migration must say what they get.
// For every object a migration creates, the same file needs a grant or revoke naming it for anon or authenticated, or the
// comment "-- no client access" on the create line or the line above it. An object an earlier migration already created is
// skipped: CREATE OR REPLACE keeps its grants. Migrations up to 025 came before this rule and are not checked.
export const FIRST_CHECKED = "026";

const KIND = /\bcreate\s+(?:or\s+replace\s+)?(?:(temp|temporary)\s+)?(?:unlogged\s+)?(table|materialized\s+view|view|sequence|function)\s+(?:if\s+not\s+exists\s+)?((?:"?\w+"?\s*\.\s*)?"?\w+"?)/gi;
const NO_CLIENT = /--\s*no client access\b/i;

/** "Public"."Foo" → public.foo, foo → public.foo */
export const objectName = (raw: string) => {
  const n = raw.replace(/["\s]/g, "").toLowerCase();
  return n.includes(".") ? n : `public.${n}`;
};
/** Comments out, line breaks kept so line numbers still match. */
const stripComments = (sql: string) => sql.replace(/--[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, " "));

export type Created = { kind: string; name: string; line: number; marked: boolean };

/** Every table, view, sequence and function the SQL creates (temporary tables left out). */
export function createdObjects(sql: string): Created[] {
  const lines = sql.split("\n");
  const code = stripComments(sql);
  const out: Created[] = [];
  for (const m of code.matchAll(KIND)) {
    if (m[1]) continue;
    const line = code.slice(0, m.index).split("\n").length; // 1-based
    out.push({ kind: m[2].toLowerCase().replace(/\s+/g, " "), name: objectName(m[3]), line,
      marked: NO_CLIENT.test(lines[line - 1] ?? "") || NO_CLIENT.test(lines[line - 2] ?? "") });
  }
  return out;
}

/** Objects named in a grant or revoke that is to or from anon or authenticated. */
export function clientGrants(sql: string): Set<string> {
  const names = new Set<string>();
  for (const stmt of stripComments(sql).split(";")) {
    const m = stmt.trim().match(/^(?:grant|revoke)\b[\s\S]*?\bon\s+([\s\S]+?)\s+(?:to|from)\s+([\s\S]+)$/i);
    if (!m || !/\b(anon|authenticated)\b/i.test(m[2])) continue;
    const list = m[1].replace(/\([^)]*\)/g, "").replace(/^\s*(table|sequence|function|view)\s+/i, "");
    for (const n of list.split(",")) if (n.trim()) names.add(objectName(n.trim().replace(/^(table|sequence|function)\s+/i, "")));
  }
  return names;
}

/** What a migration creates without saying what the client roles get. `earlier` holds the objects made by earlier migrations. */
export function missingGrants(sql: string, earlier: Set<string> = new Set()): Created[] {
  const granted = clientGrants(sql);
  return createdObjects(sql).filter((o) => !o.marked && !earlier.has(o.name) && !granted.has(o.name));
}
