import { indexCurriculum, levelProgress, neighbors } from "./curriculum.js";
import { appendChildren, h, ICONS, svgIcon } from "./dom.js";
import { gradeQuiz } from "./quiz.js";
import { completionStats, emptyProgress, normalizeProgress, PROGRESS_KEY, stepsLabel } from "./progress.js";
import { parseHash } from "./router.js";
import { lessonSearchText, moveActiveIndex, searchLessons } from "./search.js";
import { readJson, resolveTheme, THEME_KEY, toggleTheme, writeJson } from "./storage.js";
import { modifierLabel } from "./text.js";
import { mountTrainingRun, mountVisual } from "./visuals.js";

const REVIEW_KEY = "afz-review";

const state = {
  index: null,
  done: new Set(),
  route: { name: "home" },
  quizChoice: null,
  hintCount: 0,
  solutionOpen: false,
  gptRun: null,
  searchActive: 0,
  searchHits: [],
  selectedPart: null,
  lastRouteKey: "",
};

const els = {};

document.addEventListener("DOMContentLoaded", () => {
  cacheElements();
  bindChrome();
  applyTheme(resolveTheme(localStorage.getItem(THEME_KEY), false), false);
  boot();
});

function cacheElements() {
  els.main = document.querySelector("#main");
  els.nav = document.querySelector("#course-nav");
  els.progressValue = document.querySelector("#progress-value");
  els.progressBar = document.querySelector("#progress-bar");
  els.progressMeta = document.querySelector("#progress-meta");
  els.continueLink = document.querySelector("#continue-link");
  els.track = document.querySelector("#track-link");
  els.menu = document.querySelector("#menu-button");
  els.sidebar = document.querySelector("#sidebar");
  els.scrim = document.querySelector("#scrim");
  els.theme = document.querySelector("#theme-toggle");
  els.themeLabel = document.querySelector("#theme-label");
  els.searchOpen = document.querySelector("#search-open");
  els.searchKbd = document.querySelector("#search-kbd");
  els.dialog = document.querySelector("#search-dialog");
  els.searchInput = document.querySelector("#search-input");
  els.searchResults = document.querySelector("#search-results");
  els.searchEmpty = document.querySelector("#search-empty");
  els.searchClose = document.querySelector("#search-close");
  els.toast = document.querySelector("#toast");
  els.placement = document.querySelector("#placement-button");
  els.reset = document.querySelector("#reset-button");
}

function bindChrome() {
  const label = modifierLabel(navigator.userAgent);
  els.searchKbd.textContent = `${label} K`;
  els.menu.addEventListener("click", () => {
    const open = !els.sidebar.classList.contains("is-open");
    setMenu(open);
  });
  els.scrim.addEventListener("click", () => setMenu(false));
  els.theme.addEventListener("click", () => {
    const next = toggleTheme(document.documentElement.dataset.theme || "dark");
    applyTheme(next, true);
  });
  els.searchOpen.addEventListener("click", openSearch);
  els.searchClose.addEventListener("click", closeSearch);
  els.searchInput.addEventListener("input", () => {
    state.searchActive = 0;
    paintSearchResults();
  });
  els.searchInput.addEventListener("keydown", onSearchKeydown);
  els.placement.addEventListener("click", onPlacement);
  els.reset.addEventListener("click", onReset);
  els.dialog.addEventListener("click", (event) => {
    if (event.target === els.dialog) closeSearch();
  });
  document.addEventListener("keydown", onGlobalKeydown);
  window.addEventListener("hashchange", () => {
    closeSearch();
    setMenu(false);
    render({ scroll: "top" });
  });
  window.addEventListener("resize", syncSidebar);
  syncSidebar();
}

async function boot() {
  try {
    const response = await fetch(new URL("data/curriculum.json", document.baseURI));
    if (!response.ok) throw new Error(String(response.status));
    const data = await response.json();
    state.index = indexCurriculum(data);
    state.gptRun = await loadTrainingRun();
    state.done = new Set(loadDone());
    state.selectedPart = state.index.architecture[0]?.id ?? null;
    render({ scroll: "top" });
  } catch {
    els.main.replaceChildren(
      h("h1", { text: "Parcours indisponible" }),
      h("p", {
        text: "Le fichier data/curriculum.json n'a pas pu être chargé. Ouvre le site avec un serveur local, par exemple : python3 -m http.server.",
      }),
    );
  }
}

async function loadTrainingRun() {
  try {
    const response = await fetch(new URL("data/gpt_run.json", document.baseURI));
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

function loadDone() {
  const stored = normalizeProgress(readJson(localStorage, PROGRESS_KEY, emptyProgress()));
  const known = new Set(state.index ? state.index.orderedIds : []);
  return state.index ? stored.done.filter((id) => known.has(id)) : stored.done;
}

function persistDone() {
  const ordered = state.index.orderedIds.filter((id) => state.done.has(id));
  writeJson(localStorage, PROGRESS_KEY, { v: 1, done: ordered });
}

function readReview() {
  const stored = readJson(localStorage, REVIEW_KEY, {});
  if (!stored || typeof stored !== "object" || Array.isArray(stored)) return {};
  return stored;
}

function writeReviewStamp(id, present) {
  const map = readReview();
  if (present) {
    if (!map[id]) map[id] = Date.now();
  } else {
    delete map[id];
  }
  writeJson(localStorage, REVIEW_KEY, map);
}

function currentTheme() {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

function applyTheme(theme, store) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", theme === "light" ? "#f4f0e7" : "#14120f");
  if (store) localStorage.setItem(THEME_KEY, theme);
  if (els.theme) {
    const toLight = theme === "dark";
    const label = toLight ? "Activer le thème clair" : "Activer le thème sombre";
    els.theme.setAttribute("aria-label", label);
    els.theme.setAttribute("aria-pressed", theme === "dark" ? "true" : "false");
    els.themeLabel.textContent = label;
    els.theme.replaceChildren(els.themeLabel, svgIcon(theme === "dark" ? ICONS.sun : ICONS.moon));
  }
}

function setMenu(open) {
  els.sidebar.classList.toggle("is-open", open);
  els.scrim.hidden = !open;
  els.menu.setAttribute("aria-expanded", open ? "true" : "false");
  document.body.classList.toggle("menu-open", open);
  syncSidebar();
}

function syncSidebar() {
  const mobile = window.matchMedia("(max-width: 960px)").matches;
  const open = els.sidebar.classList.contains("is-open");
  if (mobile && !open) els.sidebar.setAttribute("inert", "");
  else els.sidebar.removeAttribute("inert");
}

function onGlobalKeydown(event) {
  const key = event.key.toLowerCase();
  if ((event.metaKey || event.ctrlKey) && key === "k") {
    event.preventDefault();
    if (els.dialog.hidden) openSearch();
    else closeSearch();
    return;
  }
  if (event.key === "/" && !isTyping(event.target) && els.dialog.hidden) {
    event.preventDefault();
    openSearch();
    return;
  }
  if (event.key === "Escape") {
    if (!els.dialog.hidden) {
      event.preventDefault();
      closeSearch();
      return;
    }
    if (els.sidebar.classList.contains("is-open")) setMenu(false);
  }
}

function isTyping(target) {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable;
}

function openSearch() {
  state.returnFocus = document.activeElement;
  els.dialog.hidden = false;
  document.body.classList.add("search-open");
  els.searchInput.value = "";
  state.searchActive = 0;
  paintSearchResults();
  els.searchInput.focus();
}

function closeSearch() {
  if (els.dialog.hidden) return;
  els.dialog.hidden = true;
  document.body.classList.remove("search-open");
  els.searchInput.setAttribute("aria-expanded", "false");
  els.searchInput.removeAttribute("aria-activedescendant");
  const back = state.returnFocus;
  if (back instanceof HTMLElement) back.focus();
}

function onSearchKeydown(event) {
  const count = state.searchHits.length;
  if (event.key === "ArrowDown") {
    event.preventDefault();
    state.searchActive = moveActiveIndex(state.searchActive, 1, count);
    paintSearchResults();
  } else if (event.key === "ArrowUp") {
    event.preventDefault();
    state.searchActive = moveActiveIndex(state.searchActive, -1, count);
    paintSearchResults();
  } else if (event.key === "Home") {
    event.preventDefault();
    state.searchActive = 0;
    paintSearchResults();
  } else if (event.key === "End") {
    event.preventDefault();
    state.searchActive = Math.max(0, count - 1);
    paintSearchResults();
  } else if (event.key === "Enter") {
    event.preventDefault();
    const hit = state.searchHits[state.searchActive];
    if (hit) location.hash = `#/lecon/${hit.entry.lesson.id}`;
  } else if (event.key === "Tab") {
    trapSearchTab(event);
  }
}

function trapSearchTab(event) {
  const items = [...els.dialog.querySelectorAll("button, input, a[href]")].filter((node) => !node.hasAttribute("disabled"));
  if (items.length === 0) return;
  const first = items[0];
  const last = items[items.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function entries() {
  return state.index.lessons.map((item) => ({
    ...item,
    text: lessonSearchText(item.lesson, item.level.title),
  }));
}

function paintSearchResults() {
  const query = els.searchInput.value;
  state.searchHits = searchLessons(entries(), query, 24);
  if (state.searchActive >= state.searchHits.length) state.searchActive = 0;
  const items = state.searchHits.map((hit, index) => {
    const { lesson, level } = hit.entry;
    const active = index === state.searchActive;
    return h("li", {
      id: `search-option-${index}`,
      role: "option",
      class: active ? "is-active" : "",
      "aria-selected": active ? "true" : "false",
      onClick: () => {
        location.hash = `#/lecon/${lesson.id}`;
      },
    }, [
      h("span", { class: "result-id", text: lesson.id }),
      h("span", { class: "result-copy" }, [
        h("strong", { text: lesson.title }),
        h("small", { text: `Niveau ${level.id} · ${level.title}` }),
      ]),
    ]);
  });
  if (items.length === 0) {
    els.searchResults.replaceChildren();
    els.searchEmpty.hidden = false;
    els.searchEmpty.textContent = "Aucun résultat. Essaie « gradient », « tokenizer » ou « Mamba ».";
    els.searchInput.setAttribute("aria-expanded", "false");
    els.searchInput.removeAttribute("aria-activedescendant");
    return;
  }
  els.searchEmpty.hidden = true;
  els.searchResults.replaceChildren(...items);
  els.searchInput.setAttribute("aria-expanded", "true");
  els.searchInput.setAttribute("aria-activedescendant", `search-option-${state.searchActive}`);
  items[state.searchActive]?.scrollIntoView({ block: "nearest" });
}

function stats() {
  return completionStats(state.index.orderedIds, [...state.done]);
}

function render({ scroll }) {
  const y = window.scrollY;
  const route = parseHash(location.hash);
  const routeKey = JSON.stringify(route);
  const routeChanged = routeKey !== state.lastRouteKey;
  if (routeChanged) {
    state.quizChoice = null;
    state.hintCount = 0;
    state.solutionOpen = false;
  }
  state.route = route;
  state.lastRouteKey = routeKey;
  paintChrome();
  paintMain(route);
  if (scroll === "top") window.scrollTo(0, 0);
  else window.scrollTo(0, y);
  if (scroll === "top") {
    const heading = els.main.querySelector("h1");
    if (heading && routeChanged) {
      if (!heading.hasAttribute("tabindex")) heading.setAttribute("tabindex", "-1");
      heading.focus({ preventScroll: true });
    }
  } else if (state.quizChoice != null) {
    els.main.querySelector(`[data-choice="${state.quizChoice}"]`)?.focus({ preventScroll: true });
  }
  if (route.focus === "roadmap") {
    document.querySelector("#roadmap")?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  }
}

function paintChrome() {
  const { count, percent, nextId, total } = stats();
  els.progressValue.textContent = `${percent}%`;
  els.progressBar.value = percent;
  els.progressBar.setAttribute("aria-valuenow", String(percent));
  els.progressBar.setAttribute("aria-valuemin", "0");
  els.progressBar.setAttribute("aria-valuemax", "100");
  els.progressMeta.textContent = count === 0 ? stepsLabel(0) : `${stepsLabel(count)} sur ${total}`;
  if (nextId) {
    els.continueLink.href = `#/lecon/${nextId}`;
    els.continueLink.textContent = count === 0 ? "Commencer" : "Continuer";
  } else {
    els.continueLink.href = "#/modele";
    els.continueLink.textContent = "Voir le modèle";
  }
  if (els.track) {
    if (state.route.name === "track") els.track.setAttribute("aria-current", "page");
    else els.track.removeAttribute("aria-current");
  }
  const activeLevel = activeLevelId();
  const links = state.index.levels.map((level) => {
    const progress = levelProgress(level, state.done);
    const current = level.id === activeLevel;
    const link = h("a", {
      href: `#/niveau/${level.id}`,
      class: current ? "nav-level is-active" : "nav-level",
    });
    if (current) link.setAttribute("aria-current", "page");
    appendChildren(link, [
      h("span", { class: "nav-index", text: String(level.id).padStart(2, "0") }),
      h("span", { class: "nav-name", text: level.title }),
      h("span", { class: "nav-count", text: `${progress.count}/${progress.total}` }),
    ]);
    return link;
  });
  els.nav.replaceChildren(...links);
}

function activeLevelId() {
  if (state.route.name === "level") return state.route.id;
  if (state.route.name === "lesson") return state.index.byId.get(state.route.id)?.level.id ?? null;
  return null;
}

function paintMain(route) {
  if (route.name === "home") paintHome();
  else if (route.name === "level") paintLevel(route.id);
  else if (route.name === "lesson") paintLesson(route.id);
  else if (route.name === "model") paintModel();
  else if (route.name === "track") paintTrack();
  else paintNotFound(route.path);
  document.title = pageTitle(route);
}

function pageTitle(route) {
  const base = "AI From Zero";
  if (route.name === "lesson") {
    const item = state.index.byId.get(route.id);
    return item ? `${item.lesson.id} ${item.lesson.title} · ${base}` : base;
  }
  if (route.name === "level") {
    const level = state.index.levels.find((entry) => entry.id === route.id);
    return level ? `Niveau ${level.id} · ${level.title} · ${base}` : base;
  }
  if (route.name === "model") return `Mon modèle · ${base}`;
  if (route.name === "track") return `Construire mon LLM · ${base}`;
  return `${base} — le parcours pour construire la tienne`;
}

function paintHome() {
  const { count, total, percent, nextId } = stats();
  const next = nextId ? state.index.byId.get(nextId) : null;
  const heroActions = [
    h("a", { class: "button button-primary", href: nextId ? `#/lecon/${nextId}` : "#/modele" }, nextId ? (count === 0 ? "Commencer le parcours" : "Reprendre le parcours") : "Voir le modèle"),
    h("a", { class: "button button-secondary", href: "#/parcours" }, "Voir la roadmap"),
    h("a", { class: "button button-secondary", href: "#/construire" }, "Construire mon LLM"),
  ];
  const cards = [
    statCard("Progression", `${percent} %`, stepsLabel(count)),
    statCard("Prochaine étape", next ? next.lesson.id : "Terminé", next ? next.lesson.title : "Toutes les étapes sont cochées"),
    statCard("Ton modèle", "tiny_lm.py", "Un petit modèle entraîné par rétropropagation"),
  ];
  const roadmap = h("section", { class: "panel", id: "roadmap", "aria-labelledby": "roadmap-title" }, [
    h("div", { class: "panel-head" }, [
      h("div", {}, [
        h("p", { class: "eyebrow", text: "Roadmap" }),
        h("h2", { id: "roadmap-title", text: "Treize niveaux, un seul laboratoire" }),
        h("p", { text: "Chaque niveau ajoute une brique au même projet. Rien n'est laissé au statut « planifié »." }),
      ]),
      h("p", { class: "legend", text: `${count} / ${total} étapes` }),
    ]),
    h("div", { class: "roadmap" }, state.index.levels.map((level) => levelCard(level))),
  ]);
  els.main.replaceChildren(
    h("section", { class: "hero" }, [
      h("div", {}, [
        h("p", { class: "eyebrow", text: "Laboratoire francophone" }),
        h("h1", {}, ["De zéro à ta propre ", h("em", { text: "architecture" }), "."]),
        h("p", { class: "lead", text: state.index.meta.description }),
        h("div", { class: "hero-actions" }, heroActions),
      ]),
      h("ol", { class: "hero-levels", "aria-label": "Aperçu des niveaux" }, state.index.levels.map((level) => h("li", {}, [
        h("span", { text: String(level.id).padStart(2, "0") }),
        h("span", { text: level.title }),
      ]))),
    ]),
    h("div", { class: "stat-grid" }, cards),
    reviewBlock(),
    roadmap,
  );
}

function statCard(kicker, value, detail) {
  return h("article", { class: "stat" }, [
    h("p", { class: "eyebrow", text: kicker }),
    h("p", { class: "stat-value", text: value }),
    h("p", { text: detail }),
  ]);
}

function levelCard(level) {
  const progress = levelProgress(level, state.done);
  const ratio = progress.total === 0 ? 0 : progress.count / progress.total;
  const link = h("a", {
    class: ratio === 1 ? "road-card is-done" : progress.count > 0 ? "road-card is-current" : "road-card",
    href: `#/niveau/${level.id}`,
  }, [
    h("span", { class: "road-index", text: String(level.id).padStart(2, "0") }),
    h("span", { class: "road-title", text: level.title }),
    h("span", { class: "road-meta", text: `${progress.count}/${progress.total} · ${level.steps.length} étapes` }),
    h("span", { class: "road-bar", "aria-hidden": "true" }, [
      h("span", { style: `transform: scaleX(${ratio})` }),
    ]),
  ]);
  return link;
}

function paintLevel(id) {
  const level = state.index.levels.find((entry) => entry.id === id);
  if (!level) {
    paintNotFound(`/niveau/${id}`);
    return;
  }
  const progress = levelProgress(level, state.done);
  const list = h("ol", { class: "chapter-list" });
  for (const step of level.steps) {
    const done = state.done.has(step.id);
    const item = h("li");
    const link = h("a", { class: done ? "chapter is-done" : "chapter", href: `#/lecon/${step.id}` }, [
      h("span", { class: "chapter-id", text: step.id }),
      h("span", { class: "chapter-copy" }, [
        h("span", { class: "chapter-title", text: step.title }),
        h("span", { class: "chapter-tag", text: `${step.tag} · ${step.minutes} min` }),
      ]),
      h("span", { class: "chapter-state", text: done ? "Terminée" : "À faire" }),
    ]);
    item.append(link);
    list.append(item);
  }
  els.main.replaceChildren(
    crumb([{ href: "#/", label: "Accueil" }, { label: `Niveau ${level.id}` }]),
    h("p", { class: "eyebrow", text: `Niveau ${level.id}` }),
    h("h1", { text: level.title }),
    h("p", { class: "lead", text: level.summary }),
    h("section", { class: "callout callout-build" }, [
      h("h2", { text: "Projet du niveau" }),
      h("p", { text: level.project }),
      h("p", { class: "muted", text: `${stepsLabel(progress.count)} sur ${progress.total}.` }),
    ]),
    list,
  );
}

function paintLesson(id) {
  const item = state.index.byId.get(id);
  if (!item) {
    paintNotFound(`/lecon/${id}`);
    return;
  }
  const { lesson, level } = item;
  const around = neighbors(state.index.orderedIds, lesson.id);
  const done = state.done.has(lesson.id);
  const grade = gradeQuiz(lesson.quiz.answer, state.quizChoice);
  const article = h("article", { class: "lesson", "data-lesson-id": lesson.id });
  appendChildren(article, [
    crumb([
      { href: "#/", label: "Accueil" },
      { href: `#/niveau/${level.id}`, label: `Niveau ${level.id}` },
      { label: lesson.id },
    ]),
    h("p", { class: "eyebrow", text: `${lesson.tag} · ${lesson.minutes} min` }),
    h("h1", { text: lesson.title }),
    h("div", { class: "lesson-grid" }, [
      h("div", { class: "lesson-main" }, lessonBody(lesson, grade, done, around)),
      h("aside", { class: "lesson-aside", "aria-label": "Repères de l'étape" }, [
        h("p", { class: "eyebrow", text: "Objectifs" }),
        h("ul", {}, lesson.objectives.map((goal) => h("li", { text: goal }))),
        h("p", { class: "eyebrow", text: "Prérequis" }),
        h("p", { text: lesson.prereq }),
        h("p", { class: "eyebrow", text: "Niveau" }),
        h("p", {}, [h("a", { href: `#/niveau/${level.id}`, text: level.title })]),
      ]),
    ]),
  ]);
  els.main.replaceChildren(article);
  const host = article.querySelector("[data-visual-host]");
  if (host) mountVisual(host, lesson);
  restoreLessonAids(article, lesson);
}

function lessonBody(lesson, grade, done, around) {
  const nodes = [
    h("p", { class: "lead", text: lesson.why }),
    h("figure", { class: "visual", "data-visual": lesson.visual || "flow" }, [
      h("figcaption", { text: lesson.visualCaption || "" }),
      h("div", { class: "visual-host", "data-visual-host": "true" }),
    ]),
  ];
  for (const section of lesson.sections) {
    if (section.kind === "code") nodes.push(codeBlock(section));
    else {
      nodes.push(h("section", { class: `block block-${section.kind}` }, [
        h("h2", { text: section.heading }),
        ...paragraphs(section.text),
      ]));
    }
  }
  nodes.push(
    h("section", { class: "callout callout-takeaway" }, [
      h("h2", { text: "À retenir" }),
      h("ul", {}, (lesson.takeaways || []).map((item) => h("li", { text: item }))),
    ]),
    h("section", { class: "callout callout-pitfall" }, [
      h("h2", { text: "Pièges fréquents" }),
      h("ul", {}, (lesson.pitfalls || []).map((item) => h("li", { text: item }))),
    ]),
    h("section", { class: "callout callout-exercise" }, [
      h("h2", { text: "Exercice" }),
      ...paragraphs(lesson.exercise),
      h("div", { class: "aid-actions" }, [
        h("button", { type: "button", "data-hint-button": "true", onClick: () => revealHint(lesson) }, "Indice suivant"),
        h("button", { type: "button", "data-solution-button": "true", onClick: toggleSolution }, "Voir une correction"),
      ]),
      h("ol", { id: "hint-list", "aria-live": "polite" }),
      h("div", { id: "solution", hidden: true }, paragraphs(lesson.solution || "")),
    ]),
    h("section", { class: "callout callout-build" }, [
      h("h2", { text: "Fil rouge" }),
      ...paragraphs(lesson.build),
      h("p", {}, ["Fichier : ", h("code", { text: lesson.codeFile || "model/" }), "."]),
      h("p", {}, [h("a", { href: "#/construire", text: "Ouvrir la piste « construire mon LLM »." })]),
    ]),
    h("section", { class: "callout callout-review" }, [
      h("h2", { text: "À retrouver plus tard" }),
      h("p", { text: lesson.review || "" }),
    ]),
    quizBlock(lesson, grade),
    h("div", { class: "lesson-actions" }, [
      around.prev ? h("a", { class: "button button-secondary", href: `#/lecon/${around.prev}` }, "Étape précédente") : h("span", {}),
      h("button", {
        type: "button",
        class: "button button-primary",
        disabled: !done && !grade.correct,
        onClick: () => toggleLesson(lesson.id),
      }, done ? "Retirer des étapes terminées" : "Marquer comme terminée"),
      around.next ? h("a", { class: "button button-secondary", href: `#/lecon/${around.next}` }, "Étape suivante") : h("a", { class: "button button-secondary", href: "#/modele" }, "Voir le modèle"),
    ]),
  );
  return nodes;
}

function paragraphs(text) {
  return String(text)
    .split(/\n{2,}/)
    .filter((part) => part.trim())
    .map((part) => h("p", { text: part.trim() }));
}

function codeBlock(section) {
  const code = section.code ?? "";
  let copyLabel;
  const button = h("button", {
    type: "button",
    class: "copy-button",
    onClick: async () => {
      try {
        await navigator.clipboard.writeText(code);
        copyLabel.textContent = "Copié";
      } catch {
        copyLabel.textContent = "Copie indisponible";
      }
    },
  });
  copyLabel = h("span", { text: "Copier" });
  button.append(copyLabel);
  const pre = h("pre");
  pre.append(h("code", { class: `language-${section.lang || "text"}`, text: code }));
  return h("section", { class: "block block-code" }, [
    h("div", { class: "code-head" }, [
      h("h2", { text: section.heading || "Exemple" }),
      h("span", { class: "code-lang", text: section.lang || "texte" }),
      button,
    ]),
    pre,
  ]);
}

function quizBlock(lesson, grade) {
  const quiz = lesson.quiz;
  const options = quiz.choices.map((choice, index) => {
    const selected = state.quizChoice === index;
    const classes = ["quiz-choice"];
    if (selected && grade.correct) classes.push("is-correct");
    if (selected && grade.status === "incorrect") classes.push("is-wrong");
    return h("button", {
      type: "button",
      class: classes.join(" "),
      "data-choice": String(index),
      "aria-pressed": selected ? "true" : "false",
      onClick: () => {
        state.quizChoice = index;
        render({ scroll: "keep" });
      },
    }, choice);
  });
  const feedback = h("p", {
    class: `quiz-feedback is-${grade.status}`,
    role: "status",
    text: feedbackText(lesson, grade),
  });
  return h("section", { class: "quiz", "aria-labelledby": "quiz-title" }, [
    h("h2", { id: "quiz-title", text: "Quiz" }),
    h("p", { id: "quiz-question", text: quiz.question }),
    h("div", { role: "group", "aria-labelledby": "quiz-question" }, options),
    feedback,
  ]);
}

function feedbackText(lesson, grade) {
  if (grade.status === "unanswered") return "Choisis une réponse. L'étape se coche après la bonne réponse.";
  if (grade.correct) return `Bonne réponse. ${lesson.quiz.explanation}`;
  return "Ce n'est pas la bonne réponse. Relis l'explication de l'étape et réessaie.";
}

function toggleLesson(id) {
  if (state.done.has(id)) {
    state.done.delete(id);
    writeReviewStamp(id, false);
  } else {
    state.done.add(id);
    writeReviewStamp(id, true);
  }
  persistDone();
  toast(state.done.has(id) ? "Étape enregistrée sur cet appareil." : "Étape retirée de la progression.");
  render({ scroll: "keep" });
}

function paintModel() {
  const parts = state.index.architecture;
  const selected = parts.find((part) => part.id === state.selectedPart) ?? parts[0];
  const list = h("div", { class: "pipeline", role: "list" });
  for (const part of parts) {
    const unlocked = state.done.has(part.step);
    const pressed = selected?.id === part.id;
    const button = h("button", {
      type: "button",
      class: `component${unlocked ? " is-on" : ""}${pressed ? " is-selected" : ""}`,
      "aria-pressed": pressed ? "true" : "false",
      onClick: () => {
        state.selectedPart = part.id;
        render({ scroll: "keep" });
      },
    }, [
      h("span", { class: "eyebrow", text: unlocked ? "Acquis" : "Verrouillé" }),
      h("strong", { text: part.name }),
      h("span", { text: `Étape ${part.step}` }),
    ]);
    list.append(h("div", { role: "listitem" }, [button]));
  }
  const detail = h("section", { class: "component-info", "aria-live": "polite" }, [
    h("p", { class: "eyebrow", text: "Inspecteur" }),
    h("h2", { text: selected ? selected.name : "Composant" }),
    h("p", { text: selected ? selected.summary : "" }),
    selected ? h("p", {}, [
      "Introduit à l'étape ",
      h("a", { href: `#/lecon/${selected.step}`, text: selected.step }),
      state.done.has(selected.step) ? ". Cette brique est débloquée." : ". Termine cette étape pour la débloquer.",
    ]) : null,
    h("p", { text: "Le code de référence est dans le dossier model/ du dépôt, couvert par pytest." }),
  ]);
  els.main.replaceChildren(
    crumb([{ href: "#/", label: "Accueil" }, { label: "Mon modèle" }]),
    h("p", { class: "eyebrow", text: "Fil rouge" }),
    h("h1", { text: "Architecture évolutive" }),
    h("p", { class: "lead", text: "Les briques se débloquent quand l'étape qui les introduit est terminée. Le code correspondant est dans le dossier model/." }),
    h("div", { class: "model-shell" }, [list, detail]),
  );
}

function revealHint(lesson) {
  const hints = lesson.hints || [];
  const list = document.querySelector("#hint-list");
  if (!list || state.hintCount >= hints.length) return;
  const item = document.createElement("li");
  item.textContent = hints[state.hintCount];
  list.append(item);
  state.hintCount += 1;
  if (state.hintCount >= hints.length) {
    const hintButton = document.querySelector("[data-hint-button]");
    if (hintButton) hintButton.disabled = true;
  }
}

function toggleSolution() {
  const node = document.querySelector("#solution");
  if (!node) return;
  node.hidden = !node.hidden;
  state.solutionOpen = !node.hidden;
  const button = document.querySelector("[data-solution-button]");
  if (button) button.textContent = state.solutionOpen ? "Masquer la correction" : "Voir une correction";
}

function restoreLessonAids(article, lesson) {
  const hints = lesson.hints || [];
  const list = article.querySelector("#hint-list");
  if (list) {
    for (let index = 0; index < state.hintCount && index < hints.length; index += 1) {
      const item = document.createElement("li");
      item.textContent = hints[index];
      list.append(item);
    }
  }
  const hintButton = article.querySelector("[data-hint-button]");
  if (hintButton && state.hintCount >= hints.length && hints.length > 0) hintButton.disabled = true;
  const solution = article.querySelector("#solution");
  if (solution) solution.hidden = !state.solutionOpen;
  const solutionButton = article.querySelector("[data-solution-button]");
  if (solutionButton) solutionButton.textContent = state.solutionOpen ? "Masquer la correction" : "Voir une correction";
}

function reviewBlock() {
  if (state.done.size === 0) return null;
  const stamps = readReview();
  const items = [...state.done]
    .map((id) => ({ id, at: Number(stamps[id]) || 0, item: state.index.byId.get(id) }))
    .filter((row) => row.item)
    .sort((a, b) => a.at - b.at)
    .slice(0, 3);
  if (items.length === 0) return null;
  return h("section", { class: "panel review-panel", "aria-labelledby": "review-title" }, [
    h("p", { class: "eyebrow", text: "Révision espacée" }),
    h("h2", { id: "review-title", text: "À retrouver" }),
    h("p", { text: "Ce sont les étapes cochées depuis le plus longtemps. Ferme le cours et explique-les à voix haute avant de les rouvrir." }),
    h("ul", { class: "review-list" }, items.map((row) => h("li", {}, [
      h("a", { href: `#/lecon/${row.id}` }, `${row.id} · ${row.item.lesson.title}`),
    ]))),
  ]);
}

function paintTrack() {
  const stages = state.index.track ?? [];
  const doneCount = stages.filter((stage) => state.done.has(stage.step)).length;
  const list = h("ol", { class: "track-list" });
  stages.forEach((stage, index) => {
    const done = state.done.has(stage.step);
    const item = h("li", { class: done ? "track-step is-done" : "track-step" });
    appendChildren(item, [
      h("p", { class: "eyebrow", text: done ? `Étape ${index + 1} · cochée` : `Étape ${index + 1}` }),
      h("h2", { text: stage.title }),
      h("p", { text: stage.summary }),
      h("p", {}, [
        "Fichier ",
        h("code", { text: stage.file }),
        " · leçon ",
        h("a", { href: `#/lecon/${stage.step}`, text: stage.step }),
        ".",
      ]),
    ]);
    list.append(item);
  });
  const sample = [
    "python3 -m model.gpt_train --steps 400",
    "python3 -m model.gpt_sample --prompt \"le chat \"",
  ].join("\n");
  const pre = h("pre");
  pre.append(h("code", { text: sample }));
  const runHost = h("div", { class: "visual-host", "data-run-host": "true" });
  els.main.replaceChildren(
    crumb([{ href: "#/", label: "Accueil" }, { label: "Construire" }]),
    h("p", { class: "eyebrow", text: "Fil rouge" }),
    h("h1", { text: "Construire ton LLM" }),
    h("p", { class: "lead", text: `${stages.length} étapes, d'un dossier vide jusqu'à un petit GPT entraîné par rétropropagation. Tu lis la leçon, tu ouvres le fichier cité, tu lances le code. Les cases cochées du cours allument la piste.` }),
    h("section", { class: "callout callout-build", "aria-labelledby": "run-title" }, [
      h("h2", { id: "run-title", text: "Entraînement réel" }),
      h("p", { text: state.gptRun?.label || "Un entraînement CPU déjà fait dans ce dépôt. Les nombres et les phrases viennent de ce run, pas d'un dessin." }),
      runHost,
    ]),
    h("p", { class: "track-progress", text: `${doneCount} / ${stages.length} étapes de la piste déjà cochées.` }),
    list,
    h("section", { class: "callout callout-build" }, [
      h("h2", { text: "Lancer l'entraînement" }),
      h("p", { text: "Depuis la racine du dépôt. gpt_train.py entraîne TinyGPT (embeddings, blocs, tête) avec l'autograd NumPy et AdamW. gpt_sample.py tire une suite. Le petit modèle de tiny_lm.py reste l'étape d'avant, une seule tête." }),
      pre,
    ]),
    h("section", { class: "callout" }, [
      h("h2", { text: "Ce que cette piste n'entraîne pas" }),
      h("p", { text: "RoPE, RMSNorm, SwiGLU et GQA restent des forwards. Le dos interchangeable n'est pas entraîné de bout en bout. Le scan sélectif n'est pas un bloc Mamba complet." }),
    ]),
  );
  mountTrainingRun(runHost, state.gptRun);
}

function paintNotFound(path) {
  els.main.replaceChildren(
    h("p", { class: "eyebrow", text: "Introuvable" }),
    h("h1", { text: "Cette adresse ne mène nulle part" }),
    h("p", { class: "lead", text: `Aucun contenu pour ${path || "cette route"}.` }),
    h("a", { class: "button button-primary", href: "#/" }, "Retour à l'accueil"),
  );
}

function crumb(items) {
  const nav = h("nav", { class: "breadcrumb", "aria-label": "Fil d'Ariane" });
  const list = h("ol");
  items.forEach((item, index) => {
    const li = h("li");
    if (item.href && index < items.length - 1) li.append(h("a", { href: item.href, text: item.label }));
    else li.append(h("span", { text: item.label }));
    list.append(li);
  });
  nav.append(list);
  return nav;
}

function onPlacement() {
  const level = state.index?.levels.find((entry) => entry.id === 0);
  if (!level) return;
  const ok = window.confirm("Marquer les 20 étapes du niveau 0 (fondations numériques) comme déjà connues sur cet appareil ?");
  if (!ok) return;
  for (const step of level.steps) {
    state.done.add(step.id);
    writeReviewStamp(step.id, true);
  }
  persistDone();
  toast("Fondations marquées comme connues.");
  render({ scroll: "keep" });
}

function onReset() {
  const ok = window.confirm("Effacer toute la progression enregistrée dans ce navigateur ?");
  if (!ok) return;
  state.done = new Set();
  writeJson(localStorage, REVIEW_KEY, {});
  persistDone();
  toast("Progression effacée.");
  render({ scroll: "keep" });
}

let toastTimer = 0;
function toast(message) {
  els.toast.textContent = message;
  els.toast.hidden = false;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    els.toast.hidden = true;
  }, 2800);
}
