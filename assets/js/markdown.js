/** Guides du dépôt : rendu en nœuds DOM, sans interpréter le HTML de la source. */
import { h } from "./dom.js";
export function inlineMarkdown(text, baseURL = document.baseURI) {
  const nodes = [], rx = /`([^`]+)`|\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)]+)\)/g;
  let at = 0;
  for (const match of String(text).matchAll(rx)) {
    nodes.push(String(text).slice(at, match.index));
    if (match[1]) nodes.push(h("code", { text: match[1] }));
    else if (match[2]) nodes.push(h("strong", { text: match[2] }));
    else {
      let url; try { url = new URL(match[4], baseURL); } catch { /* texte seul */ }
      nodes.push(url && ["https:", "http:"].includes(url.protocol) ? h("a", { href: url.href, target: "_blank", rel: "noopener", text: match[3] }) : match[3]);
    }
    at = match.index + match[0].length;
  }
  nodes.push(String(text).slice(at)); return nodes;
}
export function renderMarkdown(text, { baseURL = document.baseURI, titleLevel = 2 } = {}) {
  const host = h("div", { class: "rendered-guide" });
  const lines = String(text).replaceAll("\r\n", "\n").split("\n");
  const cells = line => line.trim().replace(/^\||\|$/g, "").split("|").map(s => s.trim());
  for (let i = 0; i < lines.length;) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    if (/^```/.test(line)) {
      const code = []; i++;
      while (i < lines.length && !/^```/.test(lines[i])) code.push(lines[i++]); i++;
      const copy = h("button", { type: "button", class: "copy-button", onClick: async () => {
        try { await navigator.clipboard.writeText(code.join("\n")); copy.textContent = "Copié"; }
        catch { copy.textContent = "Copie indisponible"; }
      } }, "Copier la commande ou le code");
      host.append(h("div", { class: "guide-code" }, [copy, h("pre", { tabindex: "0" }, h("code", { text: code.join("\n") }))]));
    } else if (/^#{1,6}\s/.test(line)) {
      const [, hashes, title] = line.match(/^(#+)\s+(.+)$/);
      host.append(h(`h${Math.min(6, titleLevel + hashes.length - 1)}`, {}, inlineMarkdown(title, baseURL))); i++;
    } else if (line.includes("|") && /^\s*\|?\s*:?-{3}/.test(lines[i + 1] || "")) {
      const table = h("table", { class: "guide-table" });
      table.append(h("thead", {}, h("tr", {}, cells(line).map(c => h("th", { scope: "col" }, inlineMarkdown(c, baseURL)))))); i += 2;
      const body = h("tbody");
      while (i < lines.length && lines[i].includes("|") && lines[i].trim()) body.append(h("tr", {}, cells(lines[i++]).map(c => h("td", {}, inlineMarkdown(c, baseURL)))));
      table.append(body); host.append(h("div", { class: "guide-table-scroll", tabindex: "0", role: "group", "aria-label": "Tableau du guide" }, table));
    } else if (/^\s*(?:[-*]|\d+\.)\s/.test(line)) {
      const ordered = /^\s*\d+\./.test(line), list = h(ordered ? "ol" : "ul"), pattern = ordered ? /^\s*\d+\.\s+/ : /^\s*[-*]\s+/;
      while (i < lines.length && pattern.test(lines[i])) list.append(h("li", {}, inlineMarkdown(lines[i++].replace(pattern, ""), baseURL)));
      host.append(list);
    } else {
      const paragraph = [line]; i++;
      while (i < lines.length && lines[i].trim() && !/^(?:#{1,6}\s|```|\s*[-*]\s|\s*\d+\.\s)/.test(lines[i]) && !(lines[i].includes("|") && /^\s*\|?\s*:?-{3}/.test(lines[i + 1] || ""))) paragraph.push(lines[i++]);
      host.append(h("p", {}, inlineMarkdown(paragraph.join(" "), baseURL)));
    }
  }
  return host;
}
export function tpGuideSection(text, tp) {
  return String(text).split(/(?=^## TP \d+\s)/m).find(section => new RegExp(`^## TP ${tp}\\s`).test(section))?.split(/^## (?!TP )/m)[0] || "";
}
