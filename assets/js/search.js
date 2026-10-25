/** Recherche accent-insensible sur les leçons indexées. */

import { normalize } from "./text.js";

export function lessonSearchText(lesson, levelTitle) {
  const chunks = [
    lesson.id,
    lesson.title,
    lesson.tag,
    lesson.why,
    lesson.exercise,
    lesson.build,
    lesson.prereq,
    levelTitle,
    ...(lesson.objectives ?? []),
    ...(lesson.sections ?? []).map((section) => section.text || section.code || ""),
    lesson.quiz?.question ?? "",
    lesson.quiz?.explanation ?? "",
  ];
  return chunks.join("\n");
}

export function searchLessons(entries, query, limit = 20) {
  const q = normalize(query).trim();
  const cap = Math.max(0, limit);
  if (!q) {
    return entries.slice(0, cap).map((entry) => ({ entry, score: 0 }));
  }
  const terms = q.split(/\s+/).filter(Boolean);
  const ranked = [];
  for (const entry of entries) {
    const title = normalize(entry.lesson.title);
    const id = normalize(entry.lesson.id);
    const tag = normalize(entry.lesson.tag ?? "");
    const hay = normalize(entry.text);
    const matches = terms.every((term) => hay.includes(term) || title.includes(term) || id.includes(term));
    if (!matches) continue;
    let score = 0;
    if (id === q) score += 120;
    else if (id.startsWith(q)) score += 40;
    if (title === q) score += 100;
    else if (title.startsWith(q)) score += 60;
    else if (title.includes(q)) score += 40;
    if (tag.includes(q)) score += 15;
    const at = hay.indexOf(q);
    if (at >= 0) score += Math.max(0, 24 - Math.min(at, 24));
    ranked.push({ entry, score });
  }
  ranked.sort((a, b) => b.score - a.score || compareIds(a.entry.lesson.id, b.entry.lesson.id));
  return ranked.slice(0, cap);
}

function compareIds(a, b) {
  const [am, an] = String(a).split(".").map(Number);
  const [bm, bn] = String(b).split(".").map(Number);
  return am - bm || an - bn;
}

export function moveActiveIndex(current, delta, length) {
  if (length <= 0) return -1;
  if (current < 0) return delta >= 0 ? 0 : length - 1;
  return (current + delta + length) % length;
}
