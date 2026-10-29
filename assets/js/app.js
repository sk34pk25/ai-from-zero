import { localToken, localChangeKey, readLocalReview, writeLocalReview, writeLocalDraft } from "./local-records.js";
import { registerOffline } from "./offline.js";
import {
  openWorkspace,
  closeWorkspace,
  getRecord,
  setRecord,
  subscribe,
  workspaceReady,
} from "./workspace.js";
import {
  enableLocalLearner,
  forgetLocalLearner,
  localLearnerEnabled,
  LOCAL_REVIEW_KEY,
  localOptInButton,
  localPanel,
  readLocalProgress,
  writeLocalProgress,
} from "./learner.js";
import { leavePage, onLeave } from "./lifecycle.js";
import {
  recordAttempt,
  lessonNotebook,
  prerequisiteLinks,
  learningToolbar,
  resumePanel,
  paintStudy,
  paintGlossary,
  levelCheckpoint,
} from "./study.js";
import { indexCurriculum, levelProgress, neighbors, applyLearningPath, preferredLearningPath } from "./curriculum.js";
import { appendChildren, crumb, h, ICONS, svgIcon } from "./dom.js";
import { gradeQuiz } from "./quiz.js";
import {
  isOwner,
  isPasswordRecovery,
  onAuth,
  preserveRecoveryHash,
  restoreSession,
  selectRows,
  upsertRow,
} from "./auth.js";
import {
  completionStats,
  emptyProgress,
  normalizeProgress,
  PROGRESS_KEY,
  reviewQueue,
  stepsLabel,
} from "./progress.js";
import { routeFromHref } from "./router.js";
import { lessonSearchText, moveActiveIndex, searchLessons } from "./search.js";
import {
  readJson,
  resolveTheme,
  THEME_KEY,
  toggleTheme,
  writeJson,
} from "./storage.js";
import { modifierLabel } from "./text.js";
import { mountVisual } from "./visuals.js";

const REVIEW_KEY = "afz-review";

const state = {
  booting: true,
  index: null,
  done: new Set(),
  route: { name: "home" },
  quizChoice: null,
  hintCount: 0,
  solutionOpen: false,
  gptRun: null,
  finetuneRun: null,
  owner: false,
  local: false,
  localSnapshot: null,
  localToken: null,
  quizzes: {},
  exercises: {},
  pageTicket: 0,
  searchActive: 0,
  searchHits: [],
  selectedPart: null,
  lastRouteKey: "",
};

const els = {};

/** Le propriétaire synchronise ; un visiteur qui l'a demandé garde sa progression dans ce navigateur. */
function tracking() {
  return state.owner || state.local;
}

function safeStorage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function refreshLocalMode() {
  const storage = safeStorage();
  state.local = !state.owner && Boolean(storage) && localLearnerEnabled(storage);
}

document.addEventListener("DOMContentLoaded", () => {
  cacheElements();
  bindChrome();
  applyTheme(
    resolveTheme(
      (() => {
        try {
          return localStorage.getItem(THEME_KEY);
        } catch {
          return null;
        }
      })(),
      false,
    ),
    false,
  );
  boot();
  registerOffline();
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
  window.addEventListener("afz-path-change", (event) => {
    if (!state.index) return;
    applyLearningPath(state.index, event.detail);
    state.index.focusPathChoice = true;
    render({ scroll: "keep" });
  });
  const topbar = document.querySelector(".topbar");
  if (topbar && typeof ResizeObserver !== "undefined") {
    const observer = new ResizeObserver(([entry]) => {
      const height = entry.borderBoxSize?.[0]?.blockSize || topbar.offsetHeight;
      document.documentElement.style.setProperty(
        "--header-height",
        `${height}px`,
      );
    });
    observer.observe(topbar);
  }
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
    preserveRecoveryHash();
    closeSearch();
    setMenu(false);
    render({ scroll: "top" });
  });
  window.addEventListener("storage", (event) => {
    if (state.owner || !state.index || !localChangeKey(event.key)) return;
    const wasLocal = state.local;
    refreshLocalMode(); applyStoredProgress();
    const editing = document.activeElement?.matches("textarea, input, [contenteditable=true]");
    if (wasLocal !== state.local || (!editing && !event.key?.includes("/draft/"))) render({ scroll: "keep" });
    else paintChrome();
  });
  window.addEventListener("resize", syncSidebar);
  syncSidebar();
}

async function boot() {
  try {
    const response = await fetch(
      new URL("data/curriculum.json", document.baseURI),
    );
    if (!response.ok) throw new Error(String(response.status));
    const data = await response.json();
    state.index = indexCurriculum(data, preferredLearningPath());
    state.selectedPart = state.index.architecture[0]?.id ?? null;
    onAuth(() => {
      const wasOwner = state.owner;
      state.owner = isOwner();
      refreshLocalMode();
      if (!state.owner) remotePullStarted = false;
      applyStoredProgress();
      updateAccountLink();
      if (state.owner && !wasOwner) openWorkspace().then(pullRemote);
      if (!state.owner) closeWorkspace();
      // restoreSession émet avant de se résoudre : boot peint une seule fois.
      if (state.booting) return;
      const next = routeFromHref(location.href);
      if (next.name === "connexion" && !isPasswordRecovery()) return;
      // Le formulaire affiche lui-même le résultat. Repeindre alors que
      // le propriétaire ne change pas efface « Mot de passe mis à jour ».
      if (next.name === "password" && wasOwner === state.owner) return;
      render({ scroll: "keep" });
    });
    await restoreSession();
    state.owner = isOwner();
    refreshLocalMode();
    applyStoredProgress();
    state.booting = false;
    render({ scroll: "top" });
  } catch {
    state.booting = false;
    els.main.replaceChildren(
      h("h1", { text: "Parcours indisponible" }),
      h("p", {
        text: "Le fichier data/curriculum.json n'a pas pu être chargé. Ouvre le site avec un serveur local, par exemple : python3 -m http.server.",
      }),
    );
  }
}

async function loadJsonReport(path) {
  try {
    const response = await fetch(new URL(path, document.baseURI));
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

let reportsPromise = null;

function ensureTrainingReports() {
  if (!reportsPromise) {
    reportsPromise = Promise.all([loadTrainingRun(), loadFinetuneRun()]).then(
      ([gpt, chat]) => {
        state.gptRun = gpt;
        state.finetuneRun = chat;
      },
    );
  }
  return reportsPromise;
}

async function loadTrainingRun() {
  return loadJsonReport("data/gpt_run.json");
}

async function loadFinetuneRun() {
  return loadJsonReport("data/finetune_run.json");
}

function applyStoredProgress() {
  if (!state.owner && state.local && state.index) {
    const stored = normalizeProgress(readLocalProgress(safeStorage()) || emptyProgress());
    state.localSnapshot = normalizeProgress(stored);
    state.localToken = localToken(safeStorage());
    const known = new Set(state.index.orderedIds);
    state.done = new Set(stored.done.filter((id) => known.has(id)));
    state.quizzes = stored.quizzes || {};
    state.exercises = stored.exercises || {};
    return;
  }
  if (!state.owner || !state.index) {
    state.done = new Set();
    state.quizzes = {};
    state.exercises = {};
    return;
  }
  const stored = normalizeProgress(
    getRecord(
      "progress",
      readJson(safeStorage(), PROGRESS_KEY, emptyProgress()),
    ),
  );
  const known = new Set(state.index.orderedIds);
  state.done = new Set(stored.done.filter((id) => known.has(id)));
  state.quizzes = stored.quizzes || {};
  state.exercises = stored.exercises || {};
}

function persistDone() {
  if (!state.owner && state.local) {
    const ordered = state.index.numericIds.filter((id) => state.done.has(id));
    if (
      !writeLocalProgress(safeStorage(), {
        v: 1,
        done: ordered,
        quizzes: state.quizzes,
        exercises: state.exercises,
      }, state.localSnapshot, state.localToken)
    )
      toast("Le navigateur refuse l'enregistrement local.");
    refreshLocalMode();
    applyStoredProgress();
    return;
  }
  if (!state.owner) return;
  const ordered = state.index.numericIds.filter((id) => state.done.has(id));
  writeJson(safeStorage(), PROGRESS_KEY, {
    v: 1,
    done: ordered,
    quizzes: state.quizzes,
    exercises: state.exercises,
  });
  setRecord("progress", {
    v: 1,
    done: ordered,
    quizzes: state.quizzes,
    exercises: state.exercises,
  });
}

let remotePullStarted = false;

function rememberProgressLocal() {
  const ordered = state.index.numericIds.filter((id) => state.done.has(id));
  writeJson(safeStorage(), PROGRESS_KEY, {
    v: 1,
    done: ordered,
    quizzes: state.quizzes,
    exercises: state.exercises,
  });
}

async function pullRemote() {
  if (remotePullStarted || !state.owner || !state.index) return;
  remotePullStarted = true;
  try {
    if (!getRecord("progress")) {
      const [progressRows, quizRows] = await Promise.all([
        selectRows("progress"),
        selectRows("quiz_results"),
      ]);
      for (const id of progressRows?.[0]?.done || [])
        if (state.index.byId.has(id)) state.done.add(id);
      for (const row of quizRows || [])
        if (
          state.index.byId.has(row.lesson_id) &&
          !state.quizzes[row.lesson_id]
        )
          state.quizzes[row.lesson_id] = {
            choice: row.choice,
            correct: row.correct,
          };
      if (workspaceReady()) persistDone();
    } else applyStoredProgress();
    rememberProgressLocal();
    if (!["connexion", "password", "recovery"].includes(state.route.name))
      render({ scroll: "keep" });
    else paintChrome();
  } catch {
    remotePullStarted = false;
  }
}
let lastProgressSignature = "";
subscribe(() => {
  if (!state.owner || !state.index) return;
  const stored = getRecord("progress");
  const signature = JSON.stringify(stored);
  if (stored && signature !== lastProgressSignature) {
    lastProgressSignature = signature;
    applyStoredProgress();
    rememberProgressLocal();
    if (
      !["connexion", "password", "recovery", "study"].includes(state.route.name)
    )
      render({ scroll: "keep" });
    else paintChrome();
  }
});
window.addEventListener("afz-exercise", ({ detail }) => {
  if (!tracking()) return;
  if (detail.scope === "local" && (state.owner || detail.localToken !== state.localToken)) return;
  if (detail.scope === "owner" && !state.owner) return;
  state.exercises[detail.id] = { ok: detail.ok };
  recordAttempt(detail.id, "exercise", detail.ok);
  persistDone();
});

function reviewKey() {
  return state.owner ? REVIEW_KEY : LOCAL_REVIEW_KEY;
}

function readReview() {
  if (!state.owner) return readLocalReview(safeStorage());
  const stored = readJson(safeStorage(), reviewKey(), {});
  if (!stored || typeof stored !== "object" || Array.isArray(stored)) return {};
  return stored;
}

function writeReviewStamp(id, present) {
  if (!tracking()) return;
  if (!state.owner) {
    writeLocalReview(safeStorage(), id, present, state.localToken);
    return;
  }
  const map = readReview();
  if (present) {
    if (!map[id]) map[id] = Date.now();
  } else {
    delete map[id];
  }
  writeJson(safeStorage(), reviewKey(), map);
}

function currentTheme() {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

function applyTheme(theme, store) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta)
    meta.setAttribute("content", theme === "light" ? "#f4f0e7" : "#14120f");
  if (store) { try { safeStorage()?.setItem(THEME_KEY, theme); } catch { /* thème pour cette page */ } }
  if (els.theme) {
    const toLight = theme === "dark";
    const label = toLight
      ? "Activer le thème clair"
      : "Activer le thème sombre";
    els.theme.setAttribute("aria-label", label);
    els.theme.setAttribute("aria-pressed", theme === "dark" ? "true" : "false");
    els.themeLabel.textContent = label;
    els.theme.replaceChildren(
      els.themeLabel,
      svgIcon(theme === "dark" ? ICONS.sun : ICONS.moon),
    );
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
  const items = [
    ...els.dialog.querySelectorAll("button, input, a[href]"),
  ].filter((node) => !node.hasAttribute("disabled"));
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
    return h(
      "li",
      {
        id: `search-option-${index}`,
        role: "option",
        class: active ? "is-active" : "",
        "aria-selected": active ? "true" : "false",
        onClick: () => {
          location.hash = `#/lecon/${lesson.id}`;
        },
      },
      [
        h("span", { class: "result-id", text: lesson.id }),
        h("span", { class: "result-copy" }, [
          h("strong", { text: lesson.title }),
          h("small", { text: `Niveau ${level.id} · ${level.title}` }),
        ]),
      ],
    );
  });
  if (items.length === 0) {
    els.searchResults.replaceChildren();
    els.searchEmpty.hidden = false;
    els.searchEmpty.textContent =
      "Aucun résultat. Essaie « gradient », « tokenizer » ou « Mamba ».";
    els.searchInput.setAttribute("aria-expanded", "false");
    els.searchInput.removeAttribute("aria-activedescendant");
    return;
  }
  els.searchEmpty.hidden = true;
  els.searchResults.replaceChildren(...items);
  els.searchInput.setAttribute("aria-expanded", "true");
  els.searchInput.setAttribute(
    "aria-activedescendant",
    `search-option-${state.searchActive}`,
  );
  items[state.searchActive]?.scrollIntoView({ block: "nearest" });
}

function levelsHeading(count) {
  const words = [
    "Zéro",
    "Un",
    "Deux",
    "Trois",
    "Quatre",
    "Cinq",
    "Six",
    "Sept",
    "Huit",
    "Neuf",
    "Dix",
    "Onze",
    "Douze",
    "Treize",
    "Quatorze",
    "Quinze",
  ];
  const word = words[count] || String(count);
  return `${word} niveaux, un seul laboratoire`;
}

function stats() {
  return completionStats(state.index.orderedIds, [...state.done]);
}

function render({ scroll }) {
  const y = scroll === "keep" ? window.scrollY : 0;
  leavePage();
  document.body.classList.remove("reading-mode");
  const route = routeFromHref(location.href);
  const routeKey = JSON.stringify(route);
  const routeChanged = routeKey !== state.lastRouteKey;
  const firstPaint = state.lastRouteKey === "";
  if (routeChanged) {
    state.quizChoice = null;
    state.hintCount = 0;
    state.solutionOpen = false;
    if (route.name === "lesson") {
      const saved = state.quizzes[route.id];
      if (saved && Number.isInteger(saved.choice))
        state.quizChoice = saved.choice;
    }
  }
  state.route = route;
  state.lastRouteKey = routeKey;
  state.pageTicket += 1;
  const ticket = state.pageTicket;
  els.main.dataset.paint = String(ticket);
  paintChrome();
  paintMain(route, ticket);
  if (scroll === "top") { if (!firstPaint) window.scrollTo(0, 0); }
  else window.scrollTo(0, y);
  if (scroll === "top") {
    const heading = els.main.querySelector("h1");
    if (heading && routeChanged && !firstPaint) {
      if (!heading.hasAttribute("tabindex"))
        heading.setAttribute("tabindex", "-1");
      heading.focus({ preventScroll: true });
    }
  } else if (state.quizChoice != null) {
    els.main
      .querySelector(`[data-choice="${state.quizChoice}"]`)
      ?.focus({ preventScroll: true });
  }
  if (route.focus === "roadmap") {
    document.querySelector("#roadmap")?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
      block: "start",
    });
  }
}

function updateAccountLink() {
  const link = document.querySelector("#account-link");
  if (!link) return;
  const label = link.querySelector(".account-label");
  const text = state.owner ? "Compte" : "Connexion";
  if (label) label.textContent = text;
  else link.textContent = text;
}

function paintChrome() {
  updateAccountLink();
  const { count, percent, nextId, total } = stats();
  els.progressValue.textContent = `${percent}%`;
  els.progressBar.value = percent;
  els.progressBar.setAttribute("aria-valuenow", String(percent));
  els.progressBar.setAttribute("aria-valuemin", "0");
  els.progressBar.setAttribute("aria-valuemax", "100");
  els.progressMeta.textContent =
    count === 0 ? stepsLabel(0) : `${stepsLabel(count)} sur ${total}`;
  if (nextId) {
    els.continueLink.href = `#/lecon/${nextId}`;
    els.continueLink.textContent = count === 0 ? "Commencer" : "Continuer";
  } else {
    els.continueLink.href = "#/modele";
    els.continueLink.textContent = "Voir le modèle";
  }
  if (els.track) {
    if (state.route.name === "track")
      els.track.setAttribute("aria-current", "page");
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
      h("span", {
        class: "nav-index",
        text: String(level.id).padStart(2, "0"),
      }),
      h("span", { class: "nav-name", text: level.title }),
      h("span", {
        class: "nav-count",
        text: `${progress.count}/${progress.total}`,
      }),
    ]);
    return link;
  });
  els.nav.replaceChildren(...links);
}

function activeLevelId() {
  if (state.route.name === "level") return state.route.id;
  if (state.route.name === "lesson")
    return state.index.byId.get(state.route.id)?.level.id ?? null;
  return null;
}

function paintMain(route, ticket) {
  if (route.name === "experiments")
    paintAsync(
      ticket,
      () => import("./page-experiments.js"),
      (mod) => mod.paintExperiments(els.main),
    );
  else if (route.name === "study") paintStudy(els.main, state.index);
  else if (route.name === "glossary") paintGlossary(els.main, state.index);
  else if (route.name === "placement")
    paintAsync(ticket, () => import("./placement.js"), (mod) =>
      mod.paintPlacement(els.main, {
        index: state.index,
        canTrack: tracking,
        onMarkKnown: markKnown,
        enableTracking: () => {
          const storage = safeStorage();
          if (!storage || !enableLocalLearner(storage)) {
            toast("Ce navigateur refuse le stockage local.");
            return false;
          }
          refreshLocalMode();
          applyStoredProgress();
          return true;
        },
      }),
    );
  else if (route.name === "home") paintHome();
  else if (route.name === "level") paintLevel(route.id);
  else if (route.name === "lesson") {
    paintLesson(route.id);
    import("./lesson-tools.js")
      .then((mod) => {
        if (ticket !== state.pageTicket) return;
        return mod.attachLessonTools(els.main, route.id, tracking());
      })
      .catch(() => {});
  } else if (route.name === "model")
    paintAsync(ticket, () => import("./page-model.js"), (mod) => mod.paintModel(els.main, {
      architecture: state.index.architecture,
      done: state.done,
      selectedPart: state.selectedPart,
      onSelect: (id) => {
        state.selectedPart = id;
        render({ scroll: "keep" });
      },
    }));
  else if (route.name === "track")
    paintAsync(ticket, () => import("./page-track.js"), (mod) => mod.paintTrack(els.main, {
      track: state.index.track,
      done: state.done,
      reports: { gptRun: state.gptRun, finetuneRun: state.finetuneRun },
      loadReports: () =>
        ensureTrainingReports().then(() => ({
          gptRun: state.gptRun,
          finetuneRun: state.finetuneRun,
        })),
      isCurrent: () => ticket === state.pageTicket,
    }));
  else if (route.name === "atelier")
    paintAsync(
      ticket,
      () => import("./page-atelier.js"),
      (mod) => mod.paintAtelier(els.main, state.index),
    );
  else if (route.name === "playground")
    paintAsync(
      ticket,
      () => import("./page-playground.js"),
      (mod) => mod.paintPlayground(els.main),
    );
  else if (route.name === "ide")
    paintAsync(
      ticket,
      () => import("./page-ide.js"),
      (mod) => mod.paintIde(els.main, { owner: state.owner }),
    );
  else if (route.name === "connexion")
    paintAsync(
      ticket,
      () => import("./page-connexion.js"),
      (mod) => mod.paintConnexion(els.main),
    );
  else if (route.name === "password")
    paintAsync(
      ticket,
      () => import("./page-password.js"),
      (mod) => mod.paintPassword(els.main),
    );
  else if (route.name === "recovery") paintRecovery(ticket);
  else if (route.name === "about")
    paintAsync(
      ticket,
      () => import("./page-about.js"),
      (mod) => mod.paintAbout(els.main),
    );
  else if (route.name === "donnees")
    paintAsync(
      ticket,
      () => import("./page-donnees.js"),
      (mod) => mod.paintDonnees(els.main, { owner: state.owner }),
    );
  else paintNotFound(route.path);
  document.title = pageTitle(route);
}

let recoveryModule = null;

function paintRecovery(ticket) {
  const paint = (mod) => {
    if (ticket !== state.pageTicket) return;
    mod.paintRecovery(els.main);
  };
  if (recoveryModule) {
    paint(recoveryModule);
    return;
  }
  els.main.replaceChildren(h("p", { class: "lead", text: "Chargement…" }));
  import("./page-recovery.js")
    .then((mod) => {
      recoveryModule = mod;
      paint(mod);
    })
    .catch(() => {
      if (ticket !== state.pageTicket) return;
      els.main.replaceChildren(
        h("h1", { text: "Page indisponible" }),
        h("p", { text: "Ce module n'a pas pu être chargé." }),
      );
    });
}

function paintAsync(ticket, loader, paint) {
  els.main.replaceChildren(h("p", { class: "lead", text: "Chargement…" }));
  loader()
    .then((mod) => {
      if (ticket !== state.pageTicket) return null;
      return paint(mod);
    })
    .catch(() => {
      if (ticket !== state.pageTicket) return;
      els.main.replaceChildren(
        h("h1", { text: "Page indisponible" }),
        h("p", { text: "Ce module n'a pas pu être chargé." }),
      );
    });
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
  if (route.name === "atelier") return `Atelier LLM · ${base}`;
  if (route.name === "playground") return `Playground · ${base}`;
  if (route.name === "ide") return `IDE · ${base}`;
  if (route.name === "connexion") return `Connexion · ${base}`;
  if (route.name === "password") return `Mot de passe · ${base}`;
  if (route.name === "recovery") return `Nouveau mot de passe · ${base}`;
  if (route.name === "about") return `À propos · ${base}`;
  if (route.name === "donnees") return `Données · ${base}`;
  if (route.name === "placement") return `Positionnement · ${base}`;
  return `${base} — le parcours pour construire la tienne`;
}

function paintHome() {
  const { count, total, percent, nextId } = stats();
  const next = nextId ? state.index.byId.get(nextId) : null;
  const heroActions = [
    h(
      "a",
      {
        class: "button button-primary",
        href: nextId ? `#/lecon/${nextId}` : "#/modele",
      },
      nextId
        ? count === 0
          ? "Commencer le parcours"
          : "Reprendre le parcours"
        : "Voir le modèle",
    ),
    h(
      "a",
      { class: "button button-secondary", href: "#/parcours" },
      "Voir la roadmap",
    ),
    h(
      "a",
      { class: "button button-secondary", href: "#/construire" },
      "Construire mon LLM",
    ),
    h(
      "a",
      { class: "button button-secondary", href: "#/atelier" },
      "Ouvrir les 12 TP",
    ),
  ];
  const cards = [
    statCard("Progression", `${percent} %`, stepsLabel(count)),
    statCard(
      "Prochaine étape",
      next ? next.lesson.id : "Terminé",
      next ? next.lesson.title : "Toutes les étapes sont cochées",
    ),
    statCard(
      "Ton modèle",
      "tiny_lm.py",
      "Un petit modèle entraîné par rétropropagation",
    ),
  ];
  const roadmap = h(
    "section",
    { class: "panel", id: "roadmap", "aria-labelledby": "roadmap-title" },
    [
      h("div", { class: "panel-head" }, [
        h("div", {}, [
          h("p", { class: "eyebrow", text: "Roadmap" }),
          h("h2", {
            id: "roadmap-title",
            text: levelsHeading(state.index.levels.length),
          }),
          h("p", {
            text: "Chaque niveau ajoute une brique au même projet. Rien n'est laissé au statut « planifié ».",
          }),
        ]),
        h("p", { class: "legend", text: `${count} / ${total} étapes` }),
      ]),
      h(
        "div",
        { class: "roadmap" },
        state.index.levels.map((level) => levelCard(level)),
      ),
    ],
  );
  els.main.replaceChildren(
    h("section", { class: "hero" }, [
      h("div", {}, [
        h("p", { class: "eyebrow", text: "Laboratoire francophone" }),
        h("h1", {}, [
          "De zéro à ta propre ",
          h("em", { text: "architecture" }),
          ".",
        ]),
        h("p", { class: "lead", text: state.index.meta.description }),
        h("div", { class: "hero-actions" }, heroActions),
      ]),
      h(
        "ol",
        { class: "hero-levels", "aria-label": "Aperçu des niveaux" },
        state.index.levels.map((level) =>
          h("li", {}, [
            h("span", { text: String(level.id).padStart(2, "0") }),
            h("span", { text: level.title }),
          ]),
        ),
      ),
    ]),
    h("div", { class: "stat-grid" }, cards),
    resumePanel(state.index),
    localPanel({
      owner: state.owner,
      local: state.local,
      done: state.done,
      quizzes: state.quizzes,
      exercises: state.exercises,
      orderedIds: state.index.orderedIds,
      numericIds: state.index.numericIds,
      enable: enableLocalTracking,
      importProgress: importLocalProgress,
      erase: onReset,
    }),
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
  const link = h(
    "a",
    {
      class:
        ratio === 1
          ? "road-card is-done"
          : progress.count > 0
            ? "road-card is-current"
            : "road-card",
      href: `#/niveau/${level.id}`,
    },
    [
      h("span", {
        class: "road-index",
        text: String(level.id).padStart(2, "0"),
      }),
      h("span", { class: "road-title", text: level.title }),
      h("span", {
        class: "road-meta",
        text: `${progress.count}/${progress.total} · ${level.steps.length} étapes`,
      }),
      h("span", { class: "road-bar", "aria-hidden": "true" }, [
        h("span", { style: `transform: scaleX(${ratio})` }),
      ]),
    ],
  );
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
    const link = h(
      "a",
      {
        class: done ? "chapter is-done" : "chapter",
        href: `#/lecon/${step.id}`,
      },
      [
        h("span", { class: "chapter-id", text: step.id }),
        h("span", { class: "chapter-copy" }, [
          h("span", { class: "chapter-title", text: step.title }),
          h("span", {
            class: "chapter-tag",
            text: `${step.tag} · ${step.minutes} min`,
          }),
        ]),
        h("span", {
          class: "chapter-state",
          text: done ? "Terminée" : "À faire",
        }),
      ],
    );
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
      h("p", {
        class: "muted",
        text: `${stepsLabel(progress.count)} sur ${progress.total}.`,
      }),
    ]),
    list,
    levelCheckpoint(level),
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
  const article = h("article", {
    class: "lesson",
    "data-lesson-id": lesson.id,
  });
  appendChildren(article, [
    crumb([
      { href: "#/", label: "Accueil" },
      { href: `#/niveau/${level.id}`, label: `Niveau ${level.id}` },
      { label: lesson.id },
    ]),
    h("p", { class: "eyebrow", text: `${lesson.tag} · ${lesson.minutes} min` }),
    h("h1", { text: lesson.title }),
    h("div", { class: "lesson-grid" }, [
      h(
        "div",
        { class: "lesson-main" },
        lessonBody(lesson, grade, done, around),
      ),
      h(
        "aside",
        { class: "lesson-aside", "aria-label": "Repères de l'étape" },
        [
          h("p", { class: "eyebrow", text: "Objectifs" }),
          h(
            "ul",
            {},
            lesson.objectives.map((goal) => h("li", { text: goal })),
          ),
          h("p", { class: "eyebrow", text: "Prérequis" }),
          prerequisiteLinks(lesson.prereq),
          h("p", { class: "eyebrow", text: "Niveau" }),
          h("p", {}, [
            h("a", { href: `#/niveau/${level.id}`, text: level.title }),
          ]),
        ],
      ),
    ]),
  ]);
  els.main.replaceChildren(article);
  const host = article.querySelector("[data-visual-host]");
  if (host) mountVisual(host, lesson);
  restoreLessonAids(article, lesson);
  article.prepend(learningToolbar());
  article.querySelector(".lesson-main").append(lessonNotebook(id));
  const reading = getRecord("reading", {});
  if (reading.id === id && reading.y > 0) {
    requestAnimationFrame(() => {
      if (article.isConnected) window.scrollTo(0, reading.y);
    });
  }
  let timer;
  const savePosition = () => {
    clearTimeout(timer);
    if (state.owner)
      setRecord("reading", { id, y: window.scrollY, at: Date.now() });
  };
  const watch = () => {
    clearTimeout(timer);
    timer = setTimeout(savePosition, 1500);
  };
  window.addEventListener("scroll", watch, { passive: true });
  onLeave(() => {
    window.removeEventListener("scroll", watch);
    savePosition();
  });
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
    else if (section.kind === "reference") nodes.push(h("section", { class: "block block-reference" }, [
      h("h2", { text: section.heading }),
      h("a", { href: section.href, target: "_blank", rel: "noopener", text: section.title }),
      ...paragraphs(section.text),
    ]));
    else {
      nodes.push(
        h("section", { class: `block block-${section.kind}` }, [
          h("h2", { text: section.heading }),
          ...paragraphs(section.text),
        ]),
      );
    }
  }
  nodes.push(
    h("section", { class: "callout callout-takeaway" }, [
      h("h2", { text: "À retenir" }),
      h(
        "ul",
        {},
        (lesson.takeaways || []).map((item) => h("li", { text: item })),
      ),
    ]),
    h("section", { class: "callout callout-pitfall" }, [
      h("h2", { text: "Pièges fréquents" }),
      h(
        "ul",
        {},
        (lesson.pitfalls || []).map((item) => h("li", { text: item })),
      ),
    ]),
    h("section", { class: "callout callout-exercise" }, [
      h("h2", { text: "Exercice" }),
      ...paragraphs(lesson.exercise),
      h("div", { class: "aid-actions" }, [
        h(
          "button",
          {
            type: "button",
            "data-hint-button": "true",
            onClick: () => revealHint(lesson),
          },
          "Indice suivant",
        ),
        h(
          "button",
          {
            type: "button",
            "data-solution-button": "true",
            disabled: !tracking(),
            onClick: () => {
              if (!tracking()) return;
              toggleSolution();
            },
          },
          tracking() ? "Voir une correction" : "Réservé au propriétaire",
        ),
      ]),
      h("ol", { id: "hint-list", "aria-live": "polite" }),
      h(
        "div",
        { id: "solution", hidden: true },
        paragraphs(lesson.solution || ""),
      ),
    ]),
    h("section", { class: "callout callout-build" }, [
      h("h2", { text: "Fil rouge" }),
      ...paragraphs(lesson.build),
      h("p", {}, [
        "Fichier : ",
        h("code", { text: lesson.codeFile || "model/" }),
        lesson.codeSymbol ? ` · ${lesson.codeSymbol}` : "",
        ".",
      ]),
      h("p", {}, [
        h("a", {
          href: "#/construire",
          text: "Ouvrir la piste « construire mon LLM ».",
        }),
      ]),
      ...(lesson.tpIds || []).map((id) =>
        h(
          "p",
          {},
          h("a", { href: "#/atelier", text: `Atelier · TP ${id} à compléter` }),
        ),
      ),
    ]),
    h("section", { class: "callout callout-review" }, [
      h("h2", { text: "À retrouver plus tard" }),
      h("p", { text: lesson.review || "" }),
    ]),
    quizBlock(lesson, grade),
    h("div", { class: "lesson-actions" }, [
      around.prev
        ? h(
            "a",
            {
              class: "button button-secondary",
              href: `#/lecon/${around.prev}`,
            },
            "Étape précédente",
          )
        : h("span", {}),
      h(
        "button",
        {
          type: "button",
          class: "button button-primary",
          disabled: !done && !grade.correct,
          onClick: () => toggleLesson(lesson.id),
        },
        done ? "Retirer des étapes terminées" : "Marquer comme terminée",
      ),
      around.next
        ? h(
            "a",
            {
              class: "button button-secondary",
              href: `#/lecon/${around.next}`,
            },
            "Étape suivante",
          )
        : h(
            "a",
            { class: "button button-secondary", href: "#/modele" },
            "Voir le modèle",
          ),
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
  const openIde = h(
    "button",
    {
      type: "button",
      class: "copy-button",
      disabled: !state.owner,
      onClick: async () => {
        if (!state.owner) return;
        const mod = await import("./page-ide.js");
        mod.stashSnippet(code);
        window.location.hash = "#/ide";
      },
    },
    state.owner ? "Ouvrir dans l'IDE" : "Réservé au propriétaire",
  );
  const pre = h("pre");
  pre.append(
    h("code", { class: `language-${section.lang || "text"}`, text: code }),
  );
  return h("section", { class: "block block-code" }, [
    h("div", { class: "code-head" }, [
      h("h2", { text: section.heading || "Exemple" }),
      h("span", { class: "code-lang", text: section.lang || "texte" }),
      openIde,
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
    return h(
      "button",
      {
        type: "button",
        class: classes.join(" "),
        "data-choice": String(index),
        "aria-pressed": selected ? "true" : "false",
        disabled: !tracking(),
        onClick: () => {
          if (!tracking()) return;
          state.quizChoice = index;
          recordAttempt(lesson.id, "quiz", index === lesson.quiz.answer);
          state.quizzes[lesson.id] = {
            correct: index === lesson.quiz.answer,
            choice: index,
          };
          persistDone();
          if (state.owner)
            upsertRow(
              "quiz_results",
              {
                lesson_id: lesson.id,
                choice: index,
                correct: index === lesson.quiz.answer,
              },
              "lesson_id",
            ).catch(() => toast("L'enregistrement distant a été refusé."));
          render({ scroll: "keep" });
        },
      },
      choice,
    );
  });
  const feedback = h("p", {
    class: `quiz-feedback is-${grade.status}`,
    role: "status",
    text: feedbackText(lesson, grade),
  });
  return h("section", { class: "quiz", "aria-labelledby": "quiz-title" }, [
    h("h2", { id: "quiz-title", text: "Quiz" }),
    tracking()
      ? null
      : h("div", { class: "lock-note" }, [
          h("p", {
            text: "Réservé au propriétaire, ou à toi si tu actives le suivi sur cet appareil. Rien n'est enregistré sans ton accord, et rien n'est envoyé.",
          }),
          localOptInButton(enableLocalTracking),
        ]),
    h("p", { id: "quiz-question", text: quiz.question }),
    h("div", { role: "group", "aria-labelledby": "quiz-question" }, options),
    feedback,
    tracking() && grade.correct ? correctionMark() : null,
  ]);
}

function correctionMark() {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 64 64");
  svg.setAttribute("class", "correction-mark");
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", "Schéma de la bonne réponse");
  const circle = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "circle",
  );
  circle.setAttribute("cx", "32");
  circle.setAttribute("cy", "32");
  circle.setAttribute("r", "22");
  circle.setAttribute("fill", "none");
  circle.setAttribute("stroke", "currentColor");
  circle.setAttribute("stroke-width", "3");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", "M20 33 l8 8 16-18");
  path.setAttribute("fill", "none");
  path.setAttribute("stroke", "currentColor");
  path.setAttribute("stroke-width", "3");
  path.setAttribute("stroke-linecap", "round");
  svg.append(circle, path);
  return svg;
}

function feedbackText(lesson, grade) {
  if (grade.status === "unanswered")
    return "Choisis une réponse. L'étape se coche après la bonne réponse.";
  if (grade.correct) return `Bonne réponse. ${lesson.quiz.explanation}`;
  return "Ce n'est pas la bonne réponse. Relis l'explication de l'étape et réessaie.";
}

function toggleLesson(id) {
  if (!tracking()) {
    toast("Réservé au propriétaire.");
    return;
  }
  if (state.done.has(id)) {
    state.done.delete(id);
    writeReviewStamp(id, false);
  } else {
    state.done.add(id);
    writeReviewStamp(id, true);
  }
  persistDone();
  toast(
    state.done.has(id)
      ? "Étape enregistrée sur cet appareil."
      : "Étape retirée de la progression.",
  );
  render({ scroll: "keep" });
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
  if (button)
    button.textContent = state.solutionOpen
      ? "Masquer la correction"
      : "Voir une correction";
}

function restoreLessonAids(article, lesson) {
  const hints = lesson.hints || [];
  const list = article.querySelector("#hint-list");
  if (list) {
    for (
      let index = 0;
      index < state.hintCount && index < hints.length;
      index += 1
    ) {
      const item = document.createElement("li");
      item.textContent = hints[index];
      list.append(item);
    }
  }
  const hintButton = article.querySelector("[data-hint-button]");
  if (hintButton && state.hintCount >= hints.length && hints.length > 0)
    hintButton.disabled = true;
  const solution = article.querySelector("#solution");
  if (solution) solution.hidden = !state.solutionOpen;
  const solutionButton = article.querySelector("[data-solution-button]");
  if (solutionButton)
    solutionButton.textContent = state.solutionOpen
      ? "Masquer la correction"
      : "Voir une correction";
}

function reviewBlock() {
  if (!tracking() || state.done.size === 0) return null;
  const stamps = readReview();
  const queue = reviewQueue(state.index.orderedIds, {
    done: [...state.done],
    quizzes: state.quizzes,
    exercises: state.exercises,
    stamps,
  });
  const items = queue
    .map((id) => ({ id, item: state.index.byId.get(id) }))
    .filter((row) => row.item)
    .slice(0, 3);
  if (items.length === 0) return null;
  return h(
    "section",
    { class: "panel review-panel", "aria-labelledby": "review-title" },
    [
      h("p", { class: "eyebrow", text: "Révision espacée" }),
      h("h2", { id: "review-title", text: "À retrouver" }),
      h("p", {
        text: "Ce sont les étapes cochées depuis le plus longtemps. Ferme le cours et explique-les à voix haute avant de les rouvrir.",
      }),
      h(
        "ul",
        { class: "review-list" },
        items.map((row) =>
          h("li", {}, [
            h(
              "a",
              { href: `#/lecon/${row.id}` },
              `${row.id} · ${row.item.lesson.title}`,
            ),
          ]),
        ),
      ),
    ],
  );
}

function paintNotFound(path) {
  els.main.replaceChildren(
    h("p", { class: "eyebrow", text: "Introuvable" }),
    h("h1", { text: "Cette adresse ne mène nulle part" }),
    h("p", {
      class: "lead",
      text: `Aucun contenu pour ${path || "cette route"}.`,
    }),
    h(
      "a",
      { class: "button button-primary", href: "#/" },
      "Retour à l'accueil",
    ),
  );
}

function enableLocalTracking() {
  const storage = safeStorage();
  if (!storage || !enableLocalLearner(storage)) {
    toast("Ce navigateur refuse le stockage local.");
    return false;
  }
  refreshLocalMode();
  applyStoredProgress();
  toast("Suivi activé : ta progression reste dans ce navigateur.");
  render({ scroll: "keep" });
  return true;
}

function importLocalProgress(progress, drafts = {}) {
  if (!progress || !writeLocalProgress(safeStorage(), progress, readLocalProgress(safeStorage()), state.localToken)) {
    toast("Sauvegarde non reconnue.");
    return;
  }
  applyStoredProgress();
  for (const [id, code] of Object.entries(drafts)) writeLocalDraft(safeStorage(), id, code, state.localToken);
  toast(`Progression importée : ${stepsLabel(progress.done.length).toLowerCase()}.`);
  render({ scroll: "keep" });
}

function onPlacement() {
  location.hash = "#/positionnement";
}

function markKnown(ids) {
  if (!tracking()) return;
  for (const id of ids) {
    state.done.add(id);
    writeReviewStamp(id, true);
  }
  persistDone();
  toast(`${stepsLabel(ids.length)} d'après le positionnement.`);
  render({ scroll: "keep" });
}

function onReset() {
  if (!state.owner && state.local) {
    if (!window.confirm("Effacer la progression gardée dans ce navigateur ? Exporte-la d'abord si tu veux la garder.")) return;
    forgetLocalLearner(safeStorage());
    refreshLocalMode();
    applyStoredProgress();
    toast("Progression locale effacée.");
    render({ scroll: "keep" });
    return;
  }
  if (!state.owner) {
    toast("Réservé au propriétaire.");
    return;
  }
  location.hash = "#/espace";
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
