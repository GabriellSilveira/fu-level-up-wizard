import { refreshTopCenterTrigger } from "./main.js";

const CLASS_PALETTE = [
  { name: "crimson", primary: "#ef4444", glow: "rgba(239, 68, 68, 0.55)", bg: "rgba(185, 28, 28, 0.35)" },
  { name: "gold",    primary: "#f59e0b", glow: "rgba(245, 158, 11, 0.55)", bg: "rgba(180, 83, 9, 0.35)" },
  { name: "cyan",    primary: "#06b6d4", glow: "rgba(6, 182, 212, 0.55)",  bg: "rgba(14, 116, 144, 0.35)" },
  { name: "emerald", primary: "#10b981", glow: "rgba(16, 185, 129, 0.55)", bg: "rgba(4, 120, 87, 0.35)" },
  { name: "violet",  primary: "#a855f7", glow: "rgba(168, 85, 247, 0.55)", bg: "rgba(107, 33, 168, 0.35)" }
];

const MAX_CLASSES = 5;
const MAX_SKILLS_PER_CLASS = 10;

const SPELL_GRANTING_FUIDS = new Set([
  "elemental-magic",
  "spiritual-magic",
  "entropic-magic",
  "spell-mimic",
  "magisphere"
]);

/**
 * Ícones SVG nítidos e sempre visíveis para tags, elementos, status e atributos
 */
const SVG_GLYPHS = {
  offensive: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M13 2L4 14h6l-1 8 9-12h-6l1-8z"/></svg>`,
  spell: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.2 5.8L20 10l-5.8 2.2L12 18l-2.2-5.8L4 10l5.8-2.2L12 2zm7 12l1.1 2.9L23 18l-2.9 1.1L19 22l-1.1-2.9L15 18l2.9-1.1L19 14z"/></svg>`,
  melee: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20.7 3.3a1 1 0 0 0-1.4 0l-9.6 9.6-2.3-2.3-1.4 1.4 2.3 2.3-4.3 4.3V21h2.4l4.3-4.3 2.3 2.3 1.4-1.4-2.3-2.3 9.6-9.6a1 1 0 0 0 0-1.4z"/></svg>`,
  ranged: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8zm0-13a5 5 0 1 0 5 5 5 5 0 0 0-5-5zm0 7a2 2 0 1 1 2-2 2 2 0 0 1-2 2z"/></svg>`,
  martial: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3 7h7l-5.5 4.2L18.5 21 12 16.8 5.5 21l2-7.8L2 9h7l3-7z"/></svg>`,
  hp: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>`,
  mp: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0L12 2.69z"/></svg>`,
  def: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L4 5v6.09c0 5.05 3.41 9.76 8 10.91 4.59-1.15 8-5.86 8-10.91V5l-8-3z"/></svg>`,
  mdef: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L4 5v6.09c0 5.05 3.41 9.76 8 10.91 4.59-1.15 8-5.86 8-10.91V5l-8-3zm0 4.5l1.6 3.4 3.7.5-2.7 2.6.6 3.7L12 15l-3.2 1.7.6-3.7-2.7-2.6 3.7-.5L12 6.5z"/></svg>`,
  guard: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-1 15l-4-4 1.41-1.41L11 13.17l5.59-5.59L18 9l-7 7z"/></svg>`,
  weaponEnchant: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 3l-6 6 2 2 6-6-2-2zm-8.5 7.5L3 18v3h3l7.5-7.5-3-3zM6 6l1-2 2-1-2-1-1-2-1 2-2 1 2 1 1 2z"/></svg>`,
  stagger: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46A7.93 7.93 0 0 0 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74A7.93 7.93 0 0 0 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/></svg>`,
  header: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M21 6.5c-2.5 0-4.7 1.1-6.2 2.9L12 7 9.2 9.4C7.7 7.6 5.5 6.5 3 6.5c0 3.3 2.1 6.1 5 7.1V17h8v-3.4c2.9-1 5-3.8 5-7.1z"/></svg>`,
  fire: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M13.5.67s.74 2.65.74 4.8c0 2.06-1.35 3.73-3.41 3.73-2.07 0-3.63-1.67-3.63-3.73l.03-.36C5.21 7.51 4 10.62 4 14c0 4.42 3.58 8 8 8s8-3.58 8-8C20 8.61 17.41 3.8 13.5.67z"/></svg>`,
  ice: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M22 11h-4.17l3.24-3.24-1.41-1.42L15 11h-2V9l4.66-4.66-1.42-1.41L13 6.17V2h-2v4.17L7.76 2.93 6.34 4.34 11 9v2H9L4.34 6.34 2.93 7.76 6.17 11H2v2h4.17l-3.24 3.24 1.41 1.42L9 13h2v2l-4.66 4.66 1.42 1.41L11 17.83V22h2v-4.17l3.24 3.24 1.42-1.41L13 15v-2h2l4.66 4.66 1.41-1.42L17.83 13H22v-2z"/></svg>`,
  bolt: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 2v11h3v9l7-12h-4l4-8z"/></svg>`,
  earth: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M14 6l-3.75 5 2.85 3.8-1.6 1.2C9.81 13.75 7 10 7 10l-6 8h22L14 6z"/></svg>`,
  air: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M14.5 17c0 1.65-1.35 3-3 3s-3-1.35-3-3h2c0 .55.45 1 1 1s1-.45 1-1-.45-1-1-1H2v-2h9.5c1.65 0 3 1.35 3 3zM19 6.5C19 4.57 17.43 3 15.5 3S12 4.57 12 6.5h2c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5S16.33 8 15.5 8H2v2h13.5c1.93 0 3.5-1.57 3.5-3.5zm-.5 4.5H2v2h16.5c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5v2c1.93 0 3.5-1.57 3.5-3.5S20.43 11 18.5 11z"/></svg>`,
  light: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 7a5 5 0 1 0 5 5 5 5 0 0 0-5-5zm0-5v3m0 14v3M4.22 4.22l2.12 2.12m11.32 11.32l2.12 2.12M2 12h3m14 0h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
  dark: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3a9 9 0 1 0 9 9c0-.46-.04-.92-.1-1.36a5.389 5.389 0 0 1-4.4 2.26 5.403 5.403 0 0 1-3.14-9.8c-.44-.06-.9-.1-1.36-.1z"/></svg>`,
  poison: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C7.58 2 4 5.58 4 10c0 2.76 1.4 5.19 3.53 6.62V20a1 1 0 0 0 1 1h6.94a1 1 0 0 0 1-1v-3.38C18.6 15.19 20 12.76 20 10c0-4.42-3.58-8-8-8zm-2.5 11a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm5 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z"/></svg>`,
  physical: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M14.5 3L21 9.5l-1.4 1.4-2.1-2.1-9.9 9.9 2.1 2.1L8.3 22 1.8 15.5l1.4-1.4 2.1 2.1 9.9-9.9-2.1-2.1L14.5 3z"/></svg>`,
  dazed: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm1 15h-2v-2h2zm0-4h-2V7h2z"/></svg>`,
  shaken: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/></svg>`,
  slow: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm1 11H8v-2h3V6h2z"/></svg>`,
  weak: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M16 18l2.29-2.29-4.88-4.88-4 4L2 7.41 3.41 6l6 6 4-4 6.3 6.29L22 12v6h-6z"/></svg>`,
  enraged: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-4 8l3 1.5-3 1.5V10zm8 3l-3-1.5L16 10v3zm-4 5c-2.33 0-4.31-1.46-5.11-3.5h10.22c-.8 2.04-2.78 3.5-5.11 3.5z"/></svg>`,
  poisoned: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C7.58 2 4 5.58 4 10c0 2.76 1.4 5.19 3.53 6.62V20a1 1 0 0 0 1 1h6.94a1 1 0 0 0 1-1v-3.38C18.6 15.19 20 12.76 20 10c0-4.42-3.58-8-8-8zm-2.5 11a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm5 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z"/></svg>`
};

function renderTagIcon(iconKey) {
  const cleanKey = String(iconKey || "")
    .replace(/^fu-/, "")
    .trim();
  const svg = SVG_GLYPHS[cleanKey] || SVG_GLYPHS.spell;
  return `<span class="fu-svg-glyph" aria-hidden="true">${svg}</span>`;
}

function normalizeTextKey(str = "") {
  return String(str || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

const ELEMENT_META = {
  fire: { label: "Fogo", iconKey: "fire", color: "#fb923c", bg: "rgba(249, 115, 22, 0.22)", border: "rgba(249, 115, 22, 0.6)" },
  ice: { label: "Gelo", iconKey: "ice", color: "#38bdf8", bg: "rgba(56, 189, 248, 0.22)", border: "rgba(56, 189, 248, 0.6)" },
  bolt: { label: "Raio", iconKey: "bolt", color: "#facc15", bg: "rgba(250, 204, 21, 0.22)", border: "rgba(250, 204, 21, 0.6)" },
  earth: { label: "Terra", iconKey: "earth", color: "#d97706", bg: "rgba(217, 119, 6, 0.22)", border: "rgba(217, 119, 6, 0.6)" },
  air: { label: "Ar", iconKey: "air", color: "#34d399", bg: "rgba(52, 211, 153, 0.22)", border: "rgba(52, 211, 153, 0.55)" },
  light: { label: "Luz", iconKey: "light", color: "#fef08a", bg: "rgba(254, 240, 138, 0.22)", border: "rgba(254, 240, 138, 0.6)" },
  dark: { label: "Trevas", iconKey: "dark", color: "#c084fc", bg: "rgba(192, 132, 252, 0.22)", border: "rgba(192, 132, 252, 0.6)" },
  poison: { label: "Veneno", iconKey: "poison", color: "#e879f9", bg: "rgba(217, 70, 239, 0.22)", border: "rgba(217, 70, 239, 0.6)" },
  physical: { label: "Físico", iconKey: "physical", color: "#cbd5e1", bg: "rgba(148, 163, 184, 0.22)", border: "rgba(148, 163, 184, 0.55)" }
};

const EFFECT_LABELS = {
  slow: { label: "Lento", iconKey: "slow", color: "#38bdf8", bg: "rgba(56, 189, 248, 0.2)", border: "rgba(56, 189, 248, 0.55)" },
  dazed: { label: "Atordoado", iconKey: "dazed", color: "#facc15", bg: "rgba(250, 204, 21, 0.2)", border: "rgba(250, 204, 21, 0.55)" },
  weak: { label: "Fraco", iconKey: "weak", color: "#fb923c", bg: "rgba(251, 146, 60, 0.2)", border: "rgba(251, 146, 60, 0.55)" },
  shaken: { label: "Abalado", iconKey: "shaken", color: "#c084fc", bg: "rgba(192, 132, 252, 0.2)", border: "rgba(192, 132, 252, 0.55)" },
  enraged: { label: "Enfurecido", iconKey: "enraged", color: "#f87171", bg: "rgba(248, 113, 113, 0.2)", border: "rgba(248, 113, 113, 0.55)" },
  poisoned: { label: "Envenenado", iconKey: "poisoned", color: "#e879f9", bg: "rgba(232, 121, 249, 0.2)", border: "rgba(232, 121, 249, 0.55)" },
  guard: { label: "Protegido", iconKey: "guard", color: "#60a5fa", bg: "rgba(96, 165, 250, 0.2)", border: "rgba(96, 165, 250, 0.55)" }
};

const SUPPORT_KEYWORD_RULES = [
  {
    key: "heal",
    label: "Cura",
    iconKey: "hp",
    color: "#4ade80",
    bg: "rgba(74, 222, 128, 0.18)",
    border: "rgba(74, 222, 128, 0.55)",
    regex: /\b(cura|curar|curando|recupera\w*\s+\d*\s*pontos de vida|recuperar\s+pv|heal|recover\w*\s+\d*\s*hit points)\b/i
  },
  {
    key: "mana",
    label: "Mana",
    iconKey: "mp",
    color: "#38bdf8",
    bg: "rgba(56, 189, 248, 0.18)",
    border: "rgba(56, 189, 248, 0.55)",
    regex: /\b(recupera\w*\s+\d*\s*pontos de mana|recuperar\s+pm|recover\w*\s+\d*\s*mind points)\b/i
  },
  {
    key: "mdef",
    label: "Defesa Mágica",
    iconKey: "mdef",
    color: "#818cf8",
    bg: "rgba(129, 140, 248, 0.18)",
    border: "rgba(129, 140, 248, 0.55)",
    regex: /\b(defesa mágica|def\.m|magic defense)\b/i
  },
  {
    key: "def",
    label: "Defesa",
    iconKey: "def",
    color: "#60a5fa",
    bg: "rgba(96, 165, 250, 0.18)",
    border: "rgba(96, 165, 250, 0.55)",
    regex: /\b(tratar sua defesa|bônus\s+(?:de\s+)?defesa|defense equal to)\b/i
  },
  {
    key: "resistance",
    label: "Resistência",
    iconKey: "guard",
    color: "#2dd4bf",
    bg: "rgba(45, 212, 191, 0.18)",
    border: "rgba(45, 212, 191, 0.55)",
    regex: /\b(ganha\w*\s+resistência|resistência ao tipo|resistance to)\b/i
  },
  {
    key: "enchant",
    label: "Encantamento",
    iconKey: "weaponEnchant",
    color: "#fbbf24",
    bg: "rgba(251, 191, 36, 0.18)",
    border: "rgba(251, 191, 36, 0.55)",
    regex: /\b(imbui uma arma|arma equipada|imbue a weapon)\b/i
  },
  {
    key: "cleanse",
    label: "Purificação",
    iconKey: "stagger",
    color: "#f472b6",
    bg: "rgba(244, 114, 182, 0.18)",
    border: "rgba(244, 114, 182, 0.55)",
    regex: /\b(remove\w*\s+(?:um\s+|todos\s+os\s+)?(?:efeito|condiç)|curado\s+de\s+(?:um\s+)?efeito|recover\s+from\s+(?:a\s+|all\s+)?status)\b/i
  },
  {
    key: "mobility",
    label: "Mobilidade",
    iconKey: "header",
    color: "#a7f3d0",
    bg: "rgba(167, 243, 208, 0.16)",
    border: "rgba(167, 243, 208, 0.5)",
    regex: /\b(voando|voar|teleporta|flying|fly)\b/i
  }
];

const DAMAGE_WORD_MAP = {
  fogo: "fire",
  fire: "fire",
  gelo: "ice",
  ice: "ice",
  raio: "bolt",
  raios: "bolt",
  bolt: "bolt",
  lightning: "bolt",
  terra: "earth",
  earth: "earth",
  ar: "air",
  air: "air",
  luz: "light",
  light: "light",
  trevas: "dark",
  dark: "dark",
  veneno: "poison",
  poison: "poison",
  "físico": "physical",
  "física": "physical",
  physical: "physical"
};

const STATUS_WORD_MAP = {
  lento: "slow",
  lenta: "slow",
  slow: "slow",
  confuso: "dazed",
  confusa: "dazed",
  atordoado: "dazed",
  atordoada: "dazed",
  dazed: "dazed",
  fraco: "weak",
  fraca: "weak",
  enfraquecido: "weak",
  enfraquecida: "weak",
  weak: "weak",
  abalado: "shaken",
  abalada: "shaken",
  shaken: "shaken",
  enfurecido: "enraged",
  enfurecida: "enraged",
  furioso: "enraged",
  furiosa: "enraged",
  enraged: "enraged",
  envenenado: "poisoned",
  envenenada: "poisoned",
  poisoned: "poisoned"
};

export function getPendingLevelInfo(actor) {
  const totalLevel = Math.max(1, Number(actor?.system?.level?.value ?? 1));
  const advancements = Array.isArray(actor?.system?.advancements) ? actor.system.advancements : [];
  const filled = advancements.filter((adv) => Boolean(adv?.skill?.id)).length;
  const pending = Math.max(0, totalLevel - filled);
  const nextLevel = Math.min(totalLevel, filled + 1);

  return {
    totalLevel,
    filled,
    pending,
    nextLevel
  };
}

function highlightRichKeywordsInDom(rootEl) {
  const walker = document.createTreeWalker(rootEl, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
      const parent = node.parentElement;
      if (parent && parent.closest(".fu-inline-tag, .fu-inline-effect, .fu-inline-dmg")) {
        return NodeFilter.FILTER_REJECT;
      }
      return NodeFilter.FILTER_ACCEPT;
    }
  });

  const textNodes = [];
  let current;
  while ((current = walker.nextNode())) {
    textNodes.push(current);
  }

  const combinedRegex =
    /(?<![A-Za-zÀ-ÿ])(fogo|fire|gelo|ice|raios?|bolt|lightning|terra|earth|ar|air|luz|light|trevas|dark|veneno|poison|físic[oa]|physical|lent[oa]|slow|confus[oa]|atordoad[oa]|dazed|frac[oa]|enfraquecid[oa]|weak|abalad[oa]|shaken|enfurecid[oa]|furios[oa]|enraged|envenenad[oa]|poisoned)(?![A-Za-zÀ-ÿ])/gi;

  for (const textNode of textNodes) {
    const text = textNode.nodeValue;
    combinedRegex.lastIndex = 0;
    if (!combinedRegex.test(text)) continue;

    combinedRegex.lastIndex = 0;
    const frag = document.createDocumentFragment();
    let lastIndex = 0;
    let match;

    while ((match = combinedRegex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        frag.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
      }

      const rawWord = match[0];
      const lower = rawWord.toLowerCase();
      const dmgKey = DAMAGE_WORD_MAP[lower];
      const statusKey = STATUS_WORD_MAP[lower];

      if (dmgKey && ELEMENT_META[dmgKey]) {
        const meta = ELEMENT_META[dmgKey];
        const span = document.createElement("span");
        span.className = "fu-inline-dmg";
        span.style.color = meta.color;
        span.style.borderColor = meta.border;
        span.style.background = meta.bg;
        span.innerHTML = `${renderTagIcon(meta.iconKey)}<span>${rawWord}</span>`;
        frag.appendChild(span);
      } else if (statusKey && EFFECT_LABELS[statusKey]) {
        const eff = EFFECT_LABELS[statusKey];
        const span = document.createElement("span");
        span.className = "fu-inline-effect";
        span.style.color = eff.color;
        span.style.borderColor = eff.border;
        span.style.background = eff.bg;
        span.innerHTML = `${renderTagIcon(eff.iconKey)}<span>${rawWord}</span>`;
        frag.appendChild(span);
      } else {
        frag.appendChild(document.createTextNode(rawWord));
      }

      lastIndex = match.index + rawWord.length;
    }

    if (lastIndex < text.length) {
      frag.appendChild(document.createTextNode(text.slice(lastIndex)));
    }

    textNode.parentNode.replaceChild(frag, textNode);
  }
}

function formatFUDescription(rawHtml = "") {
  if (!rawHtml) return "<p>Sem descrição disponível.</p>";

  const preformatted = rawHtml
    .replace(/@ICON\[([^\]]+)\]/gi, (_, iconName) => {
      const key = iconName.trim().toLowerCase();
      const map = {
        offensive: { label: "Ofensivo", iconKey: "offensive" },
        spell: { label: "Feitiço", iconKey: "spell" },
        melee: { label: "Corpo a Corpo", iconKey: "melee" },
        ranged: { label: "À Distância", iconKey: "ranged" },
        range: { label: "À Distância", iconKey: "ranged" },
        martial: { label: "Marcial", iconKey: "martial" },
        physical: { label: "Físico", iconKey: "physical" },
        fire: { label: "Fogo", iconKey: "fire" },
        ice: { label: "Gelo", iconKey: "ice" },
        bolt: { label: "Raio", iconKey: "bolt" },
        lightning: { label: "Raio", iconKey: "bolt" },
        earth: { label: "Terra", iconKey: "earth" },
        air: { label: "Ar", iconKey: "air" },
        wind: { label: "Ar", iconKey: "air" },
        light: { label: "Luz", iconKey: "light" },
        dark: { label: "Trevas", iconKey: "dark" },
        poison: { label: "Veneno", iconKey: "poison" }
      };
      const entry = map[key];
      if (entry) {
        return `<span class="fu-inline-tag">${renderTagIcon(entry.iconKey)} ${entry.label}</span>`;
      }
      return `<span class="fu-inline-tag">${renderTagIcon(key)} ${iconName}</span>`;
    })
    .replace(/@EFFECT\[([^\]]+)\](?:\{([^}]+)\}|\[([^\]]+)\])?/gi, (_, effKey, curlyLabel, bracketLabel) => {
      const key = effKey.trim().toLowerCase();
      const found = EFFECT_LABELS[key];
      const text = curlyLabel || bracketLabel || (found ? found.label : effKey);
      const iconKey = found ? found.iconKey : key;
      const style = found
        ? `style="color: ${found.color}; border-color: ${found.border}; background: ${found.bg};"`
        : "";
      return `<span class="fu-inline-effect" ${style}>${renderTagIcon(iconKey)} ${text}</span>`;
    })
    .replace(/@(?:GAIN|LOSS|DMG)\[([^\]]+)\](?:\{([^}]+)\}|\[([^\]]+)\])?/gi, (_, expr, curlyLabel, bracketLabel) => {
      const label = curlyLabel || bracketLabel || expr;
      return `<strong>${label}</strong>`;
    })
    .replace(/@UUID\[([^\]]+)\](?:\{([^}]+)\})?/g, (_, _uuid, label) => {
      return `<strong>${label || "Referência"}</strong>`;
    });

  const container = document.createElement("div");
  container.innerHTML = preformatted;
  highlightRichKeywordsInDom(container);
  return container.innerHTML;
}

function detectSpellElements(spellDoc) {
  const found = [];
  const addUnique = (key) => {
    const normalized = key === "lightning" ? "bolt" : key === "wind" ? "air" : key;
    if (ELEMENT_META[normalized] && normalized !== "physical" && !found.some((item) => item.key === normalized)) {
      found.push({ key: normalized, ...ELEMENT_META[normalized] });
    }
  };

  const candidateTypes = [
    spellDoc?.system?.rollInfo?.damage?.type,
    spellDoc?.system?.damage?.type,
    spellDoc?.system?.damageType?.value,
    spellDoc?.system?.damageType
  ];

  for (const t of candidateTypes) {
    if (typeof t === "string" && t.trim()) {
      addUnique(t.trim().toLowerCase());
    }
  }

  const rawDesc = spellDoc?.system?.description || "";
  const dmgTagRegex = /@DMG\[[^\]]*\b(fire|ice|bolt|lightning|earth|air|wind|light|dark|poison)\b[^\]]*\]/gi;
  let dmgMatch;
  while ((dmgMatch = dmgTagRegex.exec(rawDesc)) !== null) {
    addUnique(dmgMatch[1].toLowerCase());
  }

  const iconTagRegex = /@ICON\[(fire|ice|bolt|lightning|earth|air|wind|light|dark|poison)\]/gi;
  let iconMatch;
  while ((iconMatch = iconTagRegex.exec(rawDesc)) !== null) {
    addUnique(iconMatch[1].toLowerCase());
  }

  const plainDesc = rawDesc
    .replace(/&nbsp;/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .toLowerCase();

  if (/\bdano de fogo\b|\bfogo dano\b|\bfire damage\b/.test(plainDesc)) addUnique("fire");
  if (/\bdano de gelo\b|\bgelo dano\b|\bice damage\b/.test(plainDesc)) addUnique("ice");
  if (/\bdano de raio\b|\braio dano\b|\bbolt damage\b|\blightning damage\b/.test(plainDesc)) addUnique("bolt");
  if (/\bdano de terra\b|\bterra dano\b|\bearth damage\b/.test(plainDesc)) addUnique("earth");
  if (/\bdano de ar\b|\bar dano\b|\bair damage\b|\bwind damage\b/.test(plainDesc)) addUnique("air");
  if (/\bdano de luz\b|\bluz dano\b|\blight damage\b/.test(plainDesc)) addUnique("light");
  if (/\bdano de trevas\b|\btrevas dano\b|\bdark damage\b/.test(plainDesc)) addUnique("dark");
  if (/\bdano de veneno\b|\bveneno dano\b|\bpoison damage\b/.test(plainDesc)) addUnique("poison");

  return found;
}

function detectSupportSpellTags(spellDoc) {
  const rawDesc = spellDoc?.system?.description || "";
  const plainDesc = rawDesc
    .replace(/&nbsp;/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ");

  const tags = [];
  for (const rule of SUPPORT_KEYWORD_RULES) {
    if (rule.regex.test(plainDesc)) {
      tags.push({
        label: rule.label,
        iconKey: rule.iconKey,
        color: rule.color,
        bg: rule.bg,
        border: rule.border
      });
    }
  }
  return tags;
}

function detectSpellStatusTags(spellDoc) {
  const rawDesc = spellDoc?.system?.description || "";
  const plainDesc = rawDesc
    .replace(/&nbsp;/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .toLowerCase();

  const found = [];
  const addStatus = (key, customLabel = null) => {
    if (EFFECT_LABELS[key] && !found.some((s) => s.key === key)) {
      found.push({
        key,
        ...EFFECT_LABELS[key],
        label: customLabel || EFFECT_LABELS[key].label
      });
    }
  };

  if (/\b(atordoad[oa]|confus[oa]|dazed)\b/.test(plainDesc)) {
    addStatus("dazed", /\batordoad[oa]\b/.test(plainDesc) ? "Atordoado" : "Confuso");
  }
  if (/\b(abalad[oa]|shaken)\b/.test(plainDesc)) addStatus("shaken");
  if (/\b(lent[oa]|slow)\b/.test(plainDesc)) addStatus("slow");
  if (/\b(frac[oa]|enfraquecid[oa]|weak)\b/.test(plainDesc)) addStatus("weak");
  if (/\b(enfurecid[oa]|furios[oa]|enraged)\b/.test(plainDesc)) addStatus("enraged");
  if (/\b(envenenad[oa]|poisoned)\b/.test(plainDesc)) addStatus("poisoned");

  return found;
}

function getClassBriefDescription(classDoc) {
  const rawDesc = classDoc?.system?.description || "";
  if (rawDesc) {
    const tmp = document.createElement("div");
    tmp.innerHTML = rawDesc;
    const paragraphs = Array.from(tmp.querySelectorAll("p"));
    for (const p of paragraphs) {
      const text = (p.textContent || "").replace(/\s+/g, " ").trim();
      if (text.length > 28 && !text.startsWith("@UUID") && !text.toLowerCase().startsWith("também")) {
        return text.length > 138 ? `${text.slice(0, 135).trim()}...` : text;
      }
    }
  }
  const summary = (classDoc?.system?.summary?.value || "").trim();
  return summary || "Classe jogável de Fabula Ultima com poderes únicos.";
}

function getClassShortBenefitTag(classDoc) {
  const res = classDoc?.system?.benefits?.resources ?? {};
  const mar = classDoc?.system?.benefits?.martials ?? {};
  const tags = [];
  if (res.hp?.value) tags.push("+5 PV");
  if (res.mp?.value) tags.push("+5 PM");
  if (res.ip?.value) tags.push("+2 PI");
  if (mar.melee?.value || mar.ranged?.value) tags.push("Armas Marciais");
  if (mar.armor?.value || mar.shields?.value) tags.push("Armaduras/Escudos");
  return tags.join(" • ") || "Poderes de Classe";
}

function doesSkillGrantSpell(skillDoc) {
  const traits = Array.isArray(skillDoc?.system?.traits) ? skillDoc.system.traits : [];
  if (traits.includes("grant-spell")) return true;

  const fuid = (skillDoc?.system?.fuid || "").trim().toLowerCase();
  if (SPELL_GRANTING_FUIDS.has(fuid)) return true;

  const desc = (skillDoc?.system?.description || "").toLowerCase();
  return desc.includes("aprende um feitiço") || (desc.includes("learn a") && desc.includes("spell"));
}

export class FULevelUpWizard {
  static activeInstance = null;
  static _cachedCatalog = null;

  static async open(actor) {
    if (!actor) return;
    if (this.activeInstance) {
      this.activeInstance.destroyImmediate();
    }
    const instance = new FULevelUpWizard(actor);
    this.activeInstance = instance;
    await instance.init();
  }

  constructor(actor) {
    this.actor = actor;
    this.root = null;
    this.stage = "loading";
    this.isClosing = false;

    this.catalog = {
      classes: [],
      skillsByUuid: new Map(),
      skillsByClassFuid: new Map(),
      spells: [],
      heroicSkills: []
    };

    this.pan = { x: 0, y: 0 };
    this.zoom = 1;
    this.savedCamera = null;
    this.isRightDragging = false;
    this.dragStart = { x: 0, y: 0 };

    this.stagedNewClass = null;
    this.animateStagedSpawn = false;
    this.recentUpgradeAnim = null;
    this.pendingDezoomTransition = null;
    this.inspectedSkill = null;
    this.spellPickerContext = null;
    this.heroicPickerContext = null;
    this.activeHint = null;
    this.classPickerOpen = false;
  }

  async init() {
    this.mount();
    this.renderLoadingStage();

    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

    await this.loadCompendiumData();

    if (!this.isClosing && this.root) {
      this.renderRevealStage();
    }
  }

  renderLoadingStage() {
    this.stage = "loading";
    this.root.innerHTML = `
      <div class="fu-loading-screen">
        <div class="fu-spiral-loader" aria-hidden="true">
          <svg class="fu-spiral-svg" viewBox="0 0 140 140">
            <defs>
              <linearGradient id="fuSpiralGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#facc15" stop-opacity="1" />
                <stop offset="55%" stop-color="#f59e0b" stop-opacity="0.65" />
                <stop offset="100%" stop-color="#ef4444" stop-opacity="0" />
              </linearGradient>
            </defs>
            <path
              class="fu-spiral-path"
              d="M 70 70
                 C 70 64, 77 64, 77 70
                 C 77 79, 63 79, 63 70
                 C 63 56, 85 56, 85 70
                 C 85 88, 54 88, 54 70
                 C 54 46, 95 46, 95 70
                 C 95 98, 43 98, 43 70
                 C 43 34, 107 34, 107 70
                 C 107 110, 31 110, 31 70
                 C 31 21, 120 21, 120 70"
              fill="none"
              stroke="url(#fuSpiralGrad)"
              stroke-width="3.5"
              stroke-linecap="round"
            />
          </svg>
          <div class="fu-spiral-core-dot"></div>
        </div>
        <div class="fu-loading-text-wrap">
          <span class="fu-loading-kicker">✦ PREPARANDO EVOLUÇÃO ✦</span>
          <p class="fu-loading-label">Carregando grimório de classes, poderes, feitiços e poderes heróicos...</p>
        </div>
      </div>
    `;
  }

  async loadCompendiumData() {
    if (FULevelUpWizard._cachedCatalog) {
      this.catalog = FULevelUpWizard._cachedCatalog;
      return;
    }

    const relevantPacks = [];
    for (const pack of game.packs) {
      if (pack.documentName !== "Item") continue;
      const col = pack.collection.toLowerCase();
      const hasRelevantType =
        col.includes("class") ||
        col.includes("skill") ||
        col.includes("spell") ||
        col.includes("heroic") ||
        pack.index.some((entry) => ["class", "skill", "spell", "heroic"].includes(entry.type));

      if (hasRelevantType) {
        relevantPacks.push(pack);
      }
    }

    const allDocs = [];
    for (const pack of relevantPacks) {
      const docs = await pack.getDocuments();
      allDocs.push(...docs);
    }
    for (const item of game.items ?? []) {
      allDocs.push(item);
    }

    const seenClasses = new Set();
    const seenSpells = new Set();
    const seenHeroics = new Set();

    for (const doc of allDocs) {
      if (doc.type === "skill") {
        this.catalog.skillsByUuid.set(doc.uuid, doc);
        const classFuid = (doc.system?.class?.value || "").trim().toLowerCase();
        if (classFuid) {
          if (!this.catalog.skillsByClassFuid.has(classFuid)) {
            this.catalog.skillsByClassFuid.set(classFuid, []);
          }
          const arr = this.catalog.skillsByClassFuid.get(classFuid);
          if (!arr.some((s) => (s.system?.fuid || s.name) === (doc.system?.fuid || doc.name))) {
            arr.push(doc);
          }
        }
      } else if (doc.type === "class") {
        const key = (doc.system?.fuid || doc.name).trim().toLowerCase();
        if (!seenClasses.has(key)) {
          seenClasses.add(key);
          this.catalog.classes.push(doc);
        }
      } else if (doc.type === "spell") {
        const key = (doc.system?.fuid || doc.name).trim().toLowerCase();
        if (!seenSpells.has(key)) {
          seenSpells.add(key);
          this.catalog.spells.push(doc);
        }
      } else if (doc.type === "heroic") {
        const key = (doc.system?.fuid || doc.name).trim().toLowerCase();
        if (!seenHeroics.has(key)) {
          seenHeroics.add(key);
          this.catalog.heroicSkills.push(doc);
        }
      }
    }

    this.catalog.classes.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    this.catalog.spells.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    this.catalog.heroicSkills.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    FULevelUpWizard._cachedCatalog = this.catalog;
  }

  getSkillsForClass(classDoc) {
    const result = [];
    const seen = new Set();

    const desc = classDoc?.system?.description || "";
    const uuidRegex = /@UUID\[([^\]]+)\]/g;
    let match;
    while ((match = uuidRegex.exec(desc)) !== null) {
      const uuid = match[1];
      const skillDoc = this.catalog.skillsByUuid.get(uuid);
      if (skillDoc) {
        const key = (skillDoc.system?.fuid || skillDoc.name).toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          result.push(skillDoc);
        }
      }
    }

    const fuid = (classDoc?.system?.fuid || "").trim().toLowerCase();
    const byFuid = this.catalog.skillsByClassFuid.get(fuid) || [];
    for (const skillDoc of byFuid) {
      const key = (skillDoc.system?.fuid || skillDoc.name).toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        result.push(skillDoc);
      }
    }

    return result;
  }

  getActorClassesData() {
    const ownedClasses = this.actor.items.filter((i) => i.type === "class");
    const ownedSkills = this.actor.items.filter((i) => i.type === "skill");
    const ownedSpells = this.actor.items.filter((i) => i.type === "spell");
    const ownedHeroics = this.actor.items.filter((i) => i.type === "heroic");
    const advancements = Array.isArray(this.actor.system?.advancements) ? this.actor.system.advancements : [];

    const list = ownedClasses.map((clsItem, idx) => {
      const fuid = (clsItem.system?.fuid || "").trim().toLowerCase();
      const classSkillPool = this.getSkillsForClass(clsItem);

      const skills = classSkillPool.map((poolSkill) => {
        const poolFuid = (poolSkill.system?.fuid || "").trim().toLowerCase();
        const poolName = poolSkill.name.trim().toLowerCase();

        const actorSkill = ownedSkills.find((s) => {
          const sFuid = (s.system?.fuid || "").trim().toLowerCase();
          return (poolFuid && sFuid === poolFuid) || s.name.trim().toLowerCase() === poolName;
        });

        const currentRank = Number(actorSkill?.system?.level?.value ?? 0);
        const maxRank = Math.max(1, Number(poolSkill.system?.level?.max ?? actorSkill?.system?.level?.max ?? 1));
        const grantsSpell = doesSkillGrantSpell(poolSkill);

        const learnedSpells = [];
        const seenSpellIds = new Set();

        if (actorSkill) {
          for (const adv of advancements) {
            if (adv?.skill?.id === actorSkill.id && adv?.entries?.spell?.id) {
              const spItem = ownedSpells.find((sp) => sp.id === adv.entries.spell.id);
              if (spItem && !seenSpellIds.has(spItem.id)) {
                seenSpellIds.add(spItem.id);
                learnedSpells.push(spItem);
              }
            }
          }
        }

        if (grantsSpell && currentRank > 0) {
          for (const spItem of ownedSpells) {
            const spClass = (spItem.system?.class?.value || "").trim().toLowerCase();
            if (spClass === fuid && !seenSpellIds.has(spItem.id)) {
              seenSpellIds.add(spItem.id);
              learnedSpells.push(spItem);
            }
          }
        }

        return {
          poolDoc: poolSkill,
          actorItem: actorSkill || null,
          name: poolSkill.name,
          img: poolSkill.img,
          fuid: poolFuid,
          currentRank,
          maxRank,
          description: poolSkill.system?.description || "",
          grantsSpell,
          learnedSpells
        };
      });

      const investedPoints = skills.reduce((sum, s) => sum + s.currentRank, 0);
      const isMastered = investedPoints >= MAX_SKILLS_PER_CLASS;

      const ownedSkillIds = new Set(skills.map((s) => s.actorItem?.id).filter(Boolean));
      const claimedAdv = advancements.find(
        (adv) => adv?.entries?.heroic?.id && ownedSkillIds.has(adv?.skill?.id)
      );
      const claimedHeroicItem = claimedAdv
        ? ownedHeroics.find((h) => h.id === claimedAdv.entries.heroic.id) || null
        : null;

      return {
        isStaged: false,
        actorItem: clsItem,
        compendiumDoc: clsItem,
        id: clsItem.id,
        name: clsItem.name,
        img: clsItem.img,
        fuid,
        palette: CLASS_PALETTE[idx % CLASS_PALETTE.length],
        skills,
        investedPoints,
        isMastered,
        claimedHeroicItem
      };
    });

    if (this.stagedNewClass) {
      const stagedFuid = (this.stagedNewClass.system?.fuid || this.stagedNewClass.name).trim().toLowerCase();
      const alreadyOwned = list.some((c) => c.fuid === stagedFuid);

      if (!alreadyOwned) {
        const classSkillPool = this.getSkillsForClass(this.stagedNewClass);
        const skills = classSkillPool.map((poolSkill) => ({
          poolDoc: poolSkill,
          actorItem: null,
          name: poolSkill.name,
          img: poolSkill.img,
          fuid: (poolSkill.system?.fuid || "").trim().toLowerCase(),
          currentRank: 0,
          maxRank: Math.max(1, Number(poolSkill.system?.level?.max ?? 1)),
          description: poolSkill.system?.description || "",
          grantsSpell: doesSkillGrantSpell(poolSkill),
          learnedSpells: []
        }));

        list.push({
          isStaged: true,
          actorItem: null,
          compendiumDoc: this.stagedNewClass,
          id: null,
          name: this.stagedNewClass.name,
          img: this.stagedNewClass.img,
          fuid: stagedFuid,
          palette: CLASS_PALETTE[list.length % CLASS_PALETTE.length],
          skills,
          investedPoints: 0,
          isMastered: false,
          claimedHeroicItem: null
        });
      }
    }

    return list;
  }

  mount() {
    this.root = document.createElement("div");
    this.root.id = "fu-levelup-overlay";
    document.body.appendChild(this.root);

    this._onKeyDown = (ev) => {
      if (ev.key === "Escape") {
        if (this.heroicPickerContext) {
          this.heroicPickerContext = null;
          this.renderTreeStage();
        } else if (this.spellPickerContext) {
          this.spellPickerContext = null;
          this.renderTreeStage();
        } else if (this.inspectedSkill) {
          this.closeSkillShowcase();
        } else if (this.classPickerOpen) {
          this.closeClassPickerAnimated();
        } else if (this.activeHint) {
          this.removeHintElement();
        } else {
          this.closeWithAnimation(false);
        }
      }
    };

    this._onWindowMouseMove = (ev) => {
      if (!this.isRightDragging) return;
      this.pan.x = ev.clientX - this.dragStart.x;
      this.pan.y = ev.clientY - this.dragStart.y;
      const canvasEl = this.root?.querySelector("#fu-tree-canvas");
      if (canvasEl) {
        canvasEl.style.transform = `translate3d(${this.pan.x}px, ${this.pan.y}px, 0) scale(${this.zoom})`;
      }
    };

    this._onWindowMouseUp = (ev) => {
      if (ev.button === 2 && this.isRightDragging) {
        this.isRightDragging = false;
        this.root?.querySelector("#fu-tree-viewport")?.classList.remove("is-grabbing");
      }
    };

    window.addEventListener("keydown", this._onKeyDown);
    window.addEventListener("mousemove", this._onWindowMouseMove);
    window.addEventListener("mouseup", this._onWindowMouseUp);
  }

  destroyImmediate() {
    window.removeEventListener("keydown", this._onKeyDown);
    window.removeEventListener("mousemove", this._onWindowMouseMove);
    window.removeEventListener("mouseup", this._onWindowMouseUp);
    if (this.root) {
      this.root.remove();
      this.root = null;
    }
    if (FULevelUpWizard.activeInstance === this) {
      FULevelUpWizard.activeInstance = null;
    }
  }

  async closeWithAnimation(celebrate = false) {
    if (this.isClosing) return;
    this.isClosing = true;

    if (this.root && celebrate) {
      const flash = document.createElement("div");
      flash.className = "fu-celebrate-close-banner";
      flash.innerHTML = `
        <div class="fu-celebrate-inner">
          <span class="fu-celebrate-kicker">✦ EVOLUÇÃO CONCLUÍDA ✦</span>
          <strong>${this.actor.name} alcançou um novo patamar!</strong>
        </div>
      `;
      this.root.appendChild(flash);
      await new Promise((r) => setTimeout(r, 620));
    }

    if (this.root) {
      this.root.classList.add("is-closing");
      await new Promise((r) => setTimeout(r, 460));
    }

    this.destroyImmediate();
    refreshTopCenterTrigger();
  }

  /* ==========================================================================
   * ETAPA 1: TELA DE REVELAÇÃO ANIMADA ("NOVO NÍVEL")
   * ========================================================================== */
  renderRevealStage() {
    this.stage = "reveal";
    const info = getPendingLevelInfo(this.actor);

    const curMaxHP = Number(this.actor.system?.resources?.hp?.max ?? 0);
    const curMaxMP = Number(this.actor.system?.resources?.mp?.max ?? 0);

    const nextMaxHP = curMaxHP + 1;
    const nextMaxMP = curMaxMP + 1;

    const progressPct = Math.min(100, Math.round((info.filled / info.totalLevel) * 100));

    this.root.innerHTML = `
      <div class="fu-reveal-backdrop">
        <div class="fu-reveal-ambient-glow"></div>

        <button type="button" class="fu-overlay-close-btn" title="Fechar (ESC)">
          <i class="fas fa-times"></i> Fechar
        </button>

        <div class="fu-reveal-layout">
          <div class="fu-reveal-left">
            <div class="fu-reveal-portrait-wrap">
              <img class="fu-reveal-portrait" src="${this.actor.img}" alt="${this.actor.name}" />
            </div>
            <div class="fu-reveal-quote-box">
              <p class="fu-reveal-quote-text">Um novo patamar de poder foi alcançado. Distribua seus pontos de classe e habilidades!</p>
              <div class="fu-reveal-quote-tag">
                <span class="fu-tag-box">EVOLUÇÃO</span>
                <span class="fu-tag-actor">${this.actor.name}</span>
              </div>
            </div>
          </div>

          <div class="fu-reveal-right">
            <div class="fu-reveal-header-emblem">
              <div class="fu-triangle-emblem"></div>
              <h1 class="fu-reveal-main-title">NOVO NÍVEL</h1>
              <div class="fu-reveal-sub-title">N Í V E L &nbsp; ${info.nextLevel}</div>
              <div class="fu-reveal-divider">
                <span class="fu-div-wing left"></span>
                <span class="fu-div-dots">✦ &nbsp; ✦</span>
                <span class="fu-div-wing right"></span>
              </div>
            </div>

            <div class="fu-reveal-rank-row">
              <div class="fu-rank-fraction">
                <span class="fu-rank-small">NV</span>
                <span class="fu-rank-big">${info.nextLevel}</span>
                <span class="fu-rank-slash">/${info.totalLevel}</span>
              </div>
              <div class="fu-rank-name">${this.actor.name}</div>
              <div class="fu-rank-diamond"><span>◆</span></div>
            </div>

            <div class="fu-reveal-stats-list">
              <div class="fu-stat-row fu-anim-delay-1">
                <span class="fu-stat-label">Aumento de Vida</span>
                <span class="fu-stat-values">
                  <strong>${curMaxHP}</strong>
                  <i class="fas fa-chevron-right"></i>
                  <strong class="fu-stat-new">${nextMaxHP}</strong>
                  <small>(+5 se nova classe de PV)</small>
                </span>
                <span class="fu-stat-star">✦</span>
              </div>

              <div class="fu-stat-row fu-anim-delay-2">
                <span class="fu-stat-label">Aumento de Mana</span>
                <span class="fu-stat-values">
                  <strong>${curMaxMP}</strong>
                  <i class="fas fa-chevron-right"></i>
                  <strong class="fu-stat-new">${nextMaxMP}</strong>
                  <small>(+5 se nova classe de PM)</small>
                </span>
                <span class="fu-stat-star">✦</span>
              </div>
            </div>

            <div class="fu-reveal-progress-wrap fu-anim-delay-3">
              <div class="fu-progress-top">
                <span class="fu-lv-label">NV <strong>${info.nextLevel}</strong></span>
                <span class="fu-lv-ratio">${info.filled} / ${info.totalLevel} Preenchidos</span>
                <span class="fu-lv-pending">PENDENTES +${info.pending}</span>
              </div>
              <div class="fu-progress-track">
                <div class="fu-progress-fill" style="width: ${progressPct}%"></div>
              </div>
            </div>

            <div class="fu-reveal-actions fu-anim-delay-4">
              <button type="button" class="fu-engraved-gold-cta">
                <span class="fu-engraved-side left" aria-hidden="true"></span>
                <span class="fu-engraved-label">ESCOLHER CLASSE E HABILIDADES</span>
                <span class="fu-engraved-side right" aria-hidden="true"></span>
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    this.root.querySelector(".fu-overlay-close-btn").onclick = () => this.closeWithAnimation(false);
    this.root.querySelector(".fu-engraved-gold-cta").onclick = () => {
      this.pan = { x: 0, y: 0 };
      this.zoom = 1;
      this.renderTreeStage();
    };
  }

  /* ==========================================================================
   * ETAPA 2: ÁRVORE RADIAL DE CLASSES, HABILIDADES E RAMIFICAÇÕES DE FEITIÇOS
   * ========================================================================== */
  renderTreeStage() {
    this.stage = "tree";
    const info = getPendingLevelInfo(this.actor);
    const classesData = this.getActorClassesData();
    const canAddClass = classesData.length < MAX_CLASSES && !this.stagedNewClass;
    const upgradeAnim = this.recentUpgradeAnim;
    const dezoomTransition = this.pendingDezoomTransition;

    const initialPan = dezoomTransition ? dezoomTransition.fromPan : this.pan;
    const initialZoom = dezoomTransition ? dezoomTransition.fromZoom : this.zoom;

    this.root.innerHTML = `
      <div class="fu-tree-screen">
        <header class="fu-tree-topbar">
          <button type="button" class="fu-tree-back-btn">
            <i class="fas fa-angle-double-left"></i> VOLTAR
          </button>

          <div class="fu-tree-header-center">
            <span class="fu-tree-actor-name">${this.actor.name}</span>
            <span class="fu-tree-sep">•</span>
            <span class="fu-tree-classes-count">Classes: <strong>${classesData.length} / ${MAX_CLASSES}</strong></span>
            <span class="fu-tree-sep">•</span>
            <span class="fu-tree-drag-tip"><i class="fas fa-mouse"></i> <strong>Clique Esquerdo</strong> para abrir e selecionar • <strong>Botão Direito</strong> arrasta a tela</span>
          </div>

          <div class="fu-tree-header-right">
            <button type="button" class="fu-tree-reset-cam" title="Centralizar Árvore">
              <i class="fas fa-crosshairs"></i>
            </button>
            <div class="fu-tree-points-pill">
              Pontos de Nível: <strong>${info.pending}</strong>
            </div>
          </div>
        </header>

        <div class="fu-tree-viewport" id="fu-tree-viewport">
          <div class="fu-tree-parallax-layer" id="fu-tree-parallax-layer">
            <div class="fu-tree-canvas" id="fu-tree-canvas" style="transform: translate3d(${initialPan.x}px, ${initialPan.y}px, 0) scale(${initialZoom});">
              <svg class="fu-tree-lines-svg" id="fu-tree-lines-svg" width="2800" height="2800" viewBox="-1400 -1400 2800 2800"></svg>
              <div class="fu-tree-nodes-layer" id="fu-tree-nodes-layer"></div>
            </div>
          </div>
        </div>

        <footer class="fu-tree-bottombar">
          ${
            this.stagedNewClass
              ? `<button type="button" class="fu-cancel-staged-class-btn">
                  <i class="fas fa-undo"></i> Trocar Nova Classe (${this.stagedNewClass.name})
                </button>`
              : canAddClass
              ? `<button type="button" class="fu-new-class-btn ${classesData.length === 0 ? "fu-pulse-cta" : ""}">
                  <i class="fas fa-plus-circle"></i>
                  <span>Escolher Nova Classe (${classesData.length}/${MAX_CLASSES})</span>
                </button>`
              : `<div class="fu-max-classes-note">Limite máximo de 5 classes atingido</div>`
          }
        </footer>

        ${this.classPickerOpen ? this.buildClassPickerHTML(classesData) : ""}
        ${this.inspectedSkill ? this.buildSkillShowcaseHTML(this.inspectedSkill, info) : ""}
        ${this.spellPickerContext ? this.buildSpellPickerHTML(this.spellPickerContext) : ""}
        ${this.heroicPickerContext ? this.buildHeroicPickerHTML(this.heroicPickerContext) : ""}
      </div>
    `;

    this.populateRadialTree(classesData, info, upgradeAnim);
    this.bindTreeEvents();

    if (dezoomTransition) {
      const targetPan = { ...dezoomTransition.toPan };
      const targetZoom = dezoomTransition.toZoom;
      this.pendingDezoomTransition = null;

      requestAnimationFrame(() => {
        setTimeout(() => {
          const canvasEl = this.root?.querySelector("#fu-tree-canvas");
          if (!canvasEl) return;
          canvasEl.classList.add("is-smooth-dezoom");
          canvasEl.style.transform = `translate3d(${targetPan.x}px, ${targetPan.y}px, 0) scale(${targetZoom})`;
          setTimeout(() => {
            canvasEl.classList.remove("is-smooth-dezoom");
          }, 720);
        }, 120);
      });
    }

    this.animateStagedSpawn = false;
    this.recentUpgradeAnim = null;
  }

  populateRadialTree(classesData, info, upgradeAnim = null) {
    const svg = this.root.querySelector("#fu-tree-lines-svg");
    const layer = this.root.querySelector("#fu-tree-nodes-layer");
    const parallaxLayer = this.root.querySelector("#fu-tree-parallax-layer");
    if (!svg || !layer) return;

    [165, 365, 490].forEach((radius) => {
      const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      circle.setAttribute("cx", "0");
      circle.setAttribute("cy", "0");
      circle.setAttribute("r", String(radius));
      circle.setAttribute("fill", "none");
      circle.setAttribute("stroke", "rgba(255, 255, 255, 0.055)");
      circle.setAttribute("stroke-width", "1.2");
      circle.setAttribute("stroke-dasharray", "5 9");
      svg.appendChild(circle);
    });

    const hub = document.createElement("div");
    hub.className = "fu-radial-center-hub";
    hub.innerHTML = `
      <div class="fu-hub-outer-ring"></div>
      <div class="fu-hub-portrait-box">
        <img src="${this.actor.img}" alt="${this.actor.name}" />
      </div>
    `;
    layer.appendChild(hub);

    if (classesData.length === 0) {
      const cleanGuide = document.createElement("div");
      cleanGuide.className = "fu-empty-constellation-hint";
      cleanGuide.innerHTML = `
        <span class="fu-empty-constellation-title">Nenhuma classe vinculada</span>
        <p>Clique em <strong>Escolher Nova Classe</strong> abaixo para iniciar sua árvore de poderes.</p>
      `;
      layer.appendChild(cleanGuide);
      return;
    }

    const count = classesData.length;
    const angleStep = (Math.PI * 2) / count;
    const startAngle = -Math.PI / 2;

    classesData.forEach((cls, cIdx) => {
      const baseAngle = startAngle + cIdx * angleStep;
      const palette = cls.palette;
      const shouldSpawnAnimate = cls.isStaged && this.animateStagedSpawn;

      const sectorDist = 165;
      const sx = Math.cos(baseAngle) * sectorDist;
      const sy = Math.sin(baseAngle) * sectorDist;

      this.appendSvgLine(svg, 0, 0, sx, sy, palette.primary, 3.5, true, cls.isStaged, shouldSpawnAnimate ? 0 : null);

      const classNode = document.createElement("div");
      classNode.className = [
        "fu-class-sector-node",
        cls.isStaged ? "is-staged-class" : "",
        shouldSpawnAnimate ? "fu-spawn-sector" : ""
      ]
        .filter(Boolean)
        .join(" ");

      classNode.style.left = `${sx}px`;
      classNode.style.top = `${sy}px`;
      classNode.style.borderColor = palette.primary;
      classNode.style.boxShadow = `0 0 26px ${palette.glow}, inset 0 0 16px ${palette.bg}`;
      classNode.innerHTML = `
        ${cls.isStaged ? `<span class="fu-staged-badge">NOVA</span>` : ""}
        <img src="${cls.img}" alt="${cls.name}" />
        <span class="fu-class-sector-name">${cls.name}</span>
        <span class="fu-class-sector-lvl">${cls.investedPoints}/${MAX_SKILLS_PER_CLASS}</span>
      `;
      layer.appendChild(classNode);

      const skills = cls.skills;
      const maxSpread = count === 1 ? Math.PI * 1.4 : Math.min(Math.PI * 0.72, angleStep * 0.82);

      skills.forEach((skill, sIdx) => {
        const ratio = skills.length === 1 ? 0 : sIdx / (skills.length - 1) - 0.5;
        const skillAngle = baseAngle + ratio * maxSpread;

        const tierRadius = sIdx % 2 === 0 ? 365 : 490;
        const nx = Math.cos(skillAngle) * tierRadius;
        const ny = Math.sin(skillAngle) * tierRadius;

        const isUnlocked = skill.currentRank > 0;
        const isMaxed = skill.currentRank >= skill.maxRank;
        const isClassCapped = cls.investedPoints >= MAX_SKILLS_PER_CLASS;
        const canInvest = info.pending > 0 && !isMaxed && !isClassCapped;
        const spawnDelay = 120 + sIdx * 75;

        const isJustUpgraded =
          upgradeAnim &&
          upgradeAnim.classFuid === cls.fuid &&
          upgradeAnim.skillFuid === skill.fuid;

        this.appendSvgLine(
          svg,
          sx,
          sy,
          nx,
          ny,
          isUnlocked ? palette.primary : "rgba(148, 163, 184, 0.3)",
          isUnlocked ? 3 : 1.8,
          isUnlocked,
          false,
          shouldSpawnAnimate ? spawnDelay : null
        );

        let dotsHtml = `<div class="fu-skill-dots">`;
        for (let d = 1; d <= skill.maxRank; d++) {
          const filledDot = d <= skill.currentRank;
          const justFilledDot = isJustUpgraded && d === upgradeAnim.newRank;
          dotsHtml += `<span class="fu-dot ${filledDot ? "is-filled" : ""} ${justFilledDot ? "is-just-filled" : ""}"></span>`;
        }
        dotsHtml += `</div>`;

        const skillEl = document.createElement("div");
        skillEl.className = [
          "fu-skill-node",
          isUnlocked ? "is-unlocked" : "is-locked",
          isMaxed ? "is-maxed" : "",
          canInvest ? "is-investable" : "",
          shouldSpawnAnimate ? "fu-spawn-skill" : "",
          isJustUpgraded ? "is-just-upgraded" : ""
        ]
          .filter(Boolean)
          .join(" ");

        skillEl.style.left = `${nx}px`;
        skillEl.style.top = `${ny}px`;
        if (shouldSpawnAnimate) {
          skillEl.style.setProperty("--start-x", `${sx}px`);
          skillEl.style.setProperty("--start-y", `${sy}px`);
          skillEl.style.setProperty("--end-x", `${nx}px`);
          skillEl.style.setProperty("--end-y", `${ny}px`);
          skillEl.style.setProperty("--spawn-delay", `${spawnDelay}ms`);
        }
        if (isUnlocked) {
          skillEl.style.setProperty("--node-accent", palette.primary);
          skillEl.style.setProperty("--node-glow", palette.glow);
        }

        skillEl.innerHTML = `
          <div class="fu-skill-circle">
            <img src="${skill.img}" alt="${skill.name}" />
            ${skill.grantsSpell ? `<span class="fu-skill-spell-pin" title="Concede Feitiço">✦</span>` : ""}
            ${isJustUpgraded ? `<span class="fu-upgrade-shockwave"></span><span class="fu-upgrade-float-tag">+1 NP</span>` : ""}
          </div>
          ${dotsHtml}
          <span class="fu-skill-ratio">${skill.currentRank}/${skill.maxRank}</span>
          <span class="fu-skill-title">${skill.name}</span>
        `;

        skillEl.addEventListener("mouseenter", () => {
          if (!parallaxLayer || this.inspectedSkill) return;
          const dist = Math.hypot(nx, ny) || 1;
          const pull = 24;
          const px = -((nx / dist) * pull).toFixed(1);
          const py = -((ny / dist) * pull).toFixed(1);
          parallaxLayer.style.setProperty("--parallax-x", `${px}px`);
          parallaxLayer.style.setProperty("--parallax-y", `${py}px`);
        });

        skillEl.addEventListener("mouseleave", () => {
          if (!parallaxLayer) return;
          parallaxLayer.style.setProperty("--parallax-x", "0px");
          parallaxLayer.style.setProperty("--parallax-y", "0px");
        });

        skillEl.addEventListener("click", (ev) => {
          ev.stopPropagation();
          this.openSkillShowcase(cls, skill, nx, ny);
        });

        skillEl.addEventListener("contextmenu", (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          this.showSkillHint(skill, cls, ev.clientX, ev.clientY);
        });

        layer.appendChild(skillEl);

        if (skill.learnedSpells && skill.learnedSpells.length > 0) {
          const outAngle = Math.atan2(ny - sy, nx - sx);
          const spCount = skill.learnedSpells.length;
          const arcSpread = Math.min(Math.PI * 0.95, Math.max(0.45, (spCount - 1) * 0.48));
          const branchRadius = 132;

          skill.learnedSpells.forEach((spellItem, spIdx) => {
            const spOffset = spCount === 1 ? 0 : (spIdx / (spCount - 1) - 0.5) * arcSpread;
            const spAngle = outAngle + spOffset;
            const bx = nx + Math.cos(spAngle) * branchRadius;
            const by = ny + Math.sin(spAngle) * branchRadius;

            const elements = detectSpellElements(spellItem);
            const primaryEl = elements[0] || null;
            const branchStroke = primaryEl ? primaryEl.color : palette.primary;
            const isNewBranch = upgradeAnim && upgradeAnim.newSpellId === spellItem.id;

            this.appendSvgLine(
              svg,
              nx,
              ny,
              bx,
              by,
              branchStroke,
              2.2,
              true,
              false,
              isNewBranch ? 220 : null
            );

            const spNode = document.createElement("div");
            spNode.className = [
              "fu-spell-branch-node",
              isNewBranch ? "fu-spawn-spell-branch" : ""
            ]
              .filter(Boolean)
              .join(" ");

            spNode.style.left = `${bx}px`;
            spNode.style.top = `${by}px`;
            if (isNewBranch) {
              spNode.style.setProperty("--start-x", `${nx}px`);
              spNode.style.setProperty("--start-y", `${ny}px`);
              spNode.style.setProperty("--end-x", `${bx}px`);
              spNode.style.setProperty("--end-y", `${by}px`);
            }
            spNode.style.setProperty("--branch-color", branchStroke);

            spNode.innerHTML = `
              <div class="fu-spell-branch-frame" style="border-color: ${branchStroke}; box-shadow: 0 0 14px ${primaryEl ? primaryEl.bg : palette.glow};">
                <img src="${spellItem.img}" alt="${spellItem.name}" />
                ${
                  primaryEl
                    ? `<span class="fu-spell-branch-el-pin" style="border-color: ${primaryEl.color}; color: ${primaryEl.color};">
                        ${renderTagIcon(primaryEl.iconKey)}
                      </span>`
                    : ""
                }
              </div>
              <span class="fu-spell-branch-label">${spellItem.name}</span>
            `;

            spNode.addEventListener("click", (ev) => {
              ev.stopPropagation();
              this.showSpellBranchHint(spellItem, skill, elements, ev.clientX, ev.clientY);
            });

            spNode.addEventListener("contextmenu", (ev) => {
              ev.preventDefault();
              ev.stopPropagation();
              this.showSpellBranchHint(spellItem, skill, elements, ev.clientX, ev.clientY);
            });

            layer.appendChild(spNode);
          });
        }
      });

      const heroicDist = 660;
      const hx = Math.cos(baseAngle) * heroicDist;
      const hy = Math.sin(baseAngle) * heroicDist;

      this.appendSvgLine(
        svg,
        sx,
        sy,
        hx,
        hy,
        cls.isMastered ? "#fbbf24" : "rgba(255,255,255,0.12)",
        cls.isMastered ? 3 : 1.2,
        cls.isMastered,
        !cls.isMastered,
        shouldSpawnAnimate ? 380 : null
      );

      const heroicBtn = document.createElement("button");
      heroicBtn.type = "button";
      heroicBtn.className = [
        "fu-heroic-node-btn",
        cls.isMastered ? "is-ready" : "is-locked",
        cls.claimedHeroicItem ? "is-claimed" : ""
      ]
        .filter(Boolean)
        .join(" ");
      heroicBtn.style.left = `${hx}px`;
      heroicBtn.style.top = `${hy}px`;

      if (cls.claimedHeroicItem) {
        heroicBtn.innerHTML = `
          <img class="fu-heroic-claimed-icon" src="${cls.claimedHeroicItem.img}" alt="${cls.claimedHeroicItem.name}" />
          <span>${cls.claimedHeroicItem.name}</span>
          <small>Poder Heróico Adquirido</small>
        `;
      } else {
        heroicBtn.innerHTML = `
          <i class="fas fa-crown"></i>
          <span>Poder Heróico</span>
          <small>${cls.isMastered ? "Clique para Escolher!" : `${cls.investedPoints}/10`}</small>
        `;
      }

      heroicBtn.onclick = (ev) => {
        ev.stopPropagation();
        if (!cls.isMastered) {
          ui.notifications.info(
            `Atinja 10 níveis de habilidade em ${cls.name} (${cls.investedPoints}/10) para liberar o Poder Heróico.`
          );
          return;
        }
        if (cls.claimedHeroicItem) {
          ui.notifications.info(
            `${cls.name} já possui o Poder Heróico "${cls.claimedHeroicItem.name}".`
          );
          return;
        }
        this.heroicPickerContext = {
          selection: null,
          standaloneClass: cls,
          activeTab: "exclusive"
        };
        this.renderTreeStage();
      };
      layer.appendChild(heroicBtn);
    });
  }

  appendSvgLine(svg, x1, y1, x2, y2, stroke, width = 2, glowing = false, dashed = false, spawnDelayMs = null) {
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", String(x1));
    line.setAttribute("y1", String(y1));
    line.setAttribute("x2", String(x2));
    line.setAttribute("y2", String(y2));
    line.setAttribute("stroke", stroke);
    line.setAttribute("stroke-width", String(width));
    if (dashed) {
      line.setAttribute("stroke-dasharray", "6 6");
    }
    if (glowing) {
      line.style.filter = `drop-shadow(0 0 6px ${stroke})`;
    }
    if (spawnDelayMs !== null) {
      const length = Math.ceil(Math.hypot(x2 - x1, y2 - y1));
      line.classList.add("fu-spawn-line");
      line.style.setProperty("--line-len", String(length));
      line.style.setProperty("--spawn-delay", `${spawnDelayMs}ms`);
    }
    svg.appendChild(line);
  }

  /* ==========================================================================
   * ZOOM NA HABILIDADE + MODAL GRANDE DE INSPEÇÃO E SELEÇÃO
   * ========================================================================== */
  openSkillShowcase(cls, skill, nx, ny) {
    this.removeHintElement();
    this.savedCamera = { pan: { ...this.pan }, zoom: this.zoom };

    const targetZoom = 1.6;
    const offsetLeft = -window.innerWidth * 0.22;
    this.zoom = targetZoom;
    this.pan = {
      x: offsetLeft - nx * targetZoom,
      y: -ny * targetZoom
    };

    const canvasEl = this.root.querySelector("#fu-tree-canvas");
    if (canvasEl) {
      canvasEl.classList.add("is-smooth-dezoom");
      canvasEl.style.transform = `translate3d(${this.pan.x}px, ${this.pan.y}px, 0) scale(${this.zoom})`;
    }

    this.inspectedSkill = { cls, skill };
    setTimeout(() => {
      if (this.inspectedSkill) {
        this.renderTreeStage();
      }
    }, 240);
  }

  closeSkillShowcase() {
    const fromPan = { ...this.pan };
    const fromZoom = this.zoom;

    this.inspectedSkill = null;
    if (this.savedCamera) {
      this.pan = { ...this.savedCamera.pan };
      this.zoom = this.savedCamera.zoom;
      this.savedCamera = null;
    }

    this.pendingDezoomTransition = {
      fromPan,
      fromZoom,
      toPan: { ...this.pan },
      toZoom: this.zoom
    };

    this.renderTreeStage();
  }

  buildSkillShowcaseHTML({ cls, skill }, info) {
    const isMaxed = skill.currentRank >= skill.maxRank;
    const isClassCapped = cls.investedPoints >= MAX_SKILLS_PER_CLASS;
    const willReachMastery = cls.investedPoints + 1 === MAX_SKILLS_PER_CLASS;
    const canInvest = info.pending > 0 && !isMaxed && !isClassCapped;
    const npPct = Math.round((skill.currentRank / skill.maxRank) * 100);

    let ctaLabel = "SELECIONAR";
    if (canInvest && skill.grantsSpell && willReachMastery) {
      ctaLabel = "SELECIONAR, FEITIÇO & PODER HERÓICO";
    } else if (canInvest && skill.grantsSpell) {
      ctaLabel = "SELECIONAR & ESCOLHER FEITIÇO";
    } else if (canInvest && willReachMastery) {
      ctaLabel = "SELECIONAR & ESCOLHER PODER HERÓICO";
    } else if (isMaxed) {
      ctaLabel = "NÍVEL MÁXIMO ATINGIDO";
    } else if (isClassCapped) {
      ctaLabel = "CLASSE COMPLETA (10/10)";
    } else if (info.pending <= 0) {
      ctaLabel = "SEM PONTOS PENDENTES";
    }

    return `
      <div class="fu-skill-showcase-backdrop" id="fu-skill-showcase-backdrop">
        <div class="fu-skill-showcase-container" id="fu-skill-showcase-container">
          <div class="fu-showcase-left">
            <div class="fu-showcase-frame">
              <div class="fu-showcase-geo-ring ring-1"></div>
              <div class="fu-showcase-geo-ring ring-2"></div>
              <div class="fu-showcase-dots-diag">• • • • •</div>

              <div class="fu-showcase-icon-pedestal">
                <img src="${skill.img}" alt="${skill.name}" />
              </div>
            </div>

            <div class="fu-showcase-title-banner">
              <div class="fu-showcase-emblem-circle">
                <span>✦</span>
              </div>
              <h2 class="fu-showcase-skill-name">${skill.name}</h2>
            </div>
          </div>

          <div class="fu-showcase-right">
            <div class="fu-showcase-rail">
              <span class="fu-rail-dot top"></span>
              <span class="fu-rail-dot mid"></span>
              <span class="fu-rail-dot bot"></span>
            </div>

            <div class="fu-showcase-class-header">
              <div class="fu-showcase-class-badge">
                <img src="${cls.img}" alt="${cls.name}" />
              </div>
              <span class="fu-showcase-class-title">${cls.name}</span>
            </div>

            <div class="fu-showcase-np-block">
              <div class="fu-showcase-np-top">
                <span><i class="fas fa-star"></i> Nível do Poder (NP)</span>
                <strong>${skill.currentRank} / ${skill.maxRank}</strong>
              </div>
              <div class="fu-showcase-np-bar">
                <div class="fu-showcase-np-fill" style="width: ${npPct}%"></div>
              </div>
            </div>

            ${
              skill.grantsSpell && canInvest
                ? `<div class="fu-showcase-spell-notice">
                    <i class="fas fa-hat-wizard"></i>
                    <span>Ao selecionar este poder, você escolherá <strong>1 Feitiço</strong> da lista de ${cls.name}.</span>
                  </div>`
                : ""
            }

            ${
              willReachMastery && canInvest
                ? `<div class="fu-showcase-heroic-notice">
                    <i class="fas fa-crown"></i>
                    <span>Este ponto completa <strong>10/10 em ${cls.name}</strong> e libera um <strong>Poder Heróico</strong>!</span>
                  </div>`
                : ""
            }

            <div class="fu-showcase-desc-box">
              ${formatFUDescription(skill.description)}
            </div>

            <div class="fu-showcase-actions">
              <button type="button" class="fu-showcase-back-btn" id="fu-showcase-cancel-btn">
                <i class="fas fa-arrow-left"></i> VOLTAR
              </button>

              <button
                type="button"
                class="fu-showcase-select-btn"
                id="fu-showcase-confirm-btn"
                ${!canInvest ? "disabled" : ""}
              >
                <span>${ctaLabel}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  /* ==========================================================================
   * MODAL 3º PASSO: GRIMÓRIO DE FEITIÇOS (APRENDIDOS NO FINAL + TAGS COM ÍCONES)
   * ========================================================================== */
  getSpellsForClass(classFuid, showAll = false) {
    const ownedSpells = this.actor.items.filter((i) => i.type === "spell");
    const ownedKeys = new Set(
      ownedSpells
        .flatMap((s) => [(s.system?.fuid || "").trim().toLowerCase(), s.name.trim().toLowerCase()])
        .filter(Boolean)
    );

    let pool = this.catalog.spells;
    if (!showAll) {
      const filtered = pool.filter((sp) => (sp.system?.class?.value || "").trim().toLowerCase() === classFuid);
      if (filtered.length > 0) {
        pool = filtered;
      }
    }

    const mapped = pool.map((sp) => {
      const fuid = (sp.system?.fuid || "").trim().toLowerCase();
      const nameKey = sp.name.trim().toLowerCase();
      const alreadyKnown = (fuid && ownedKeys.has(fuid)) || ownedKeys.has(nameKey);
      const mpCost = sp.system?.cost?.amount || sp.system?.mpCost?.value || "0";
      const isOffensive = Boolean(sp.system?.isOffensive?.value || sp.system?.hasRoll?.value);
      const elements = detectSpellElements(sp);
      const supportTags = detectSupportSpellTags(sp);
      const statusTags = detectSpellStatusTags(sp);

      const targetMap = {
        single: "Uma criatura",
        multiple: "Múltiplos alvos",
        self: "Pessoal",
        weapon: "Arma equipada",
        special: "Especial"
      };
      const rawTarget = (sp.system?.targeting?.rule || "").toLowerCase();
      const targetLabel = targetMap[rawTarget] || "Alvo do Feitiço";

      return {
        doc: sp,
        uuid: sp.uuid,
        name: sp.name,
        img: sp.img,
        alreadyKnown,
        mpCost,
        isOffensive,
        elements,
        supportTags,
        statusTags,
        targetLabel,
        description: sp.system?.description || ""
      };
    });

    mapped.sort((a, b) => {
      if (a.alreadyKnown !== b.alreadyKnown) {
        return a.alreadyKnown ? 1 : -1;
      }
      return a.name.localeCompare(b.name, "pt-BR");
    });

    return mapped;
  }

  buildSpellPickerHTML({ selection, showAllSpells }) {
    const spells = this.getSpellsForClass(selection.classFuid, showAllSpells);

    const bannersHtml = spells
      .map((sp) => {
        const primaryEl = sp.elements[0] || null;
        let badgesHtml = "";

        if (sp.isOffensive) {
          if (sp.elements.length > 0) {
            badgesHtml += sp.elements
              .map(
                (el) => `
                <span class="fu-el-pill" style="color: ${el.color}; background: ${el.bg}; border-color: ${el.border};">
                  ${renderTagIcon(el.iconKey)} ${el.label}
                </span>
              `
              )
              .join("");
          } else if (sp.statusTags.length > 0) {
            badgesHtml += sp.statusTags
              .map(
                (st) => `
                <span class="fu-el-pill" style="color: ${st.color}; background: ${st.bg}; border-color: ${st.border};">
                  ${renderTagIcon(st.iconKey)} ${st.label}
                </span>
              `
              )
              .join("");
          } else {
            badgesHtml = `<span class="fu-el-pill neutral">${renderTagIcon("offensive")} Ofensivo</span>`;
          }
        } else {
          const combinedSupport = [...sp.supportTags];
          if (sp.elements.length === 1) {
            combinedSupport.push(sp.elements[0]);
          }

          if (combinedSupport.length > 0) {
            badgesHtml = combinedSupport
              .map(
                (tag) => `
                <span class="fu-el-pill" style="color: ${tag.color}; background: ${tag.bg}; border-color: ${tag.border};">
                  ${renderTagIcon(tag.iconKey)} ${tag.label}
                </span>
              `
              )
              .join("");
          } else {
            badgesHtml = `<span class="fu-el-pill neutral">${renderTagIcon("spell")} Suporte / Utilidade</span>`;
          }
        }

        return `
          <div class="fu-banner-spell-card ${sp.alreadyKnown ? "is-known" : ""}" data-search="${sp.name.toLowerCase()}">
            <span class="fu-banner-ribbon left"></span>
            <span class="fu-banner-ribbon right"></span>

            <div class="fu-banner-card-frame">
              <h4 class="fu-banner-spell-title">${sp.name}</h4>
              <div class="fu-banner-subtitle">
                ${sp.isOffensive ? "Feitiço Ofensivo" : "Feitiço Arcano"} • ${selection.className}
              </div>

              <div class="fu-banner-medallion" style="${primaryEl ? `border-color: ${primaryEl.color}; box-shadow: 0 0 22px ${primaryEl.bg};` : ""}">
                <img src="${sp.img}" alt="${sp.name}" />
                ${
                  primaryEl
                    ? `<span class="fu-medallion-element-badge" title="Dano de ${primaryEl.label}" style="border-color: ${primaryEl.color}; color: ${primaryEl.color};">
                        ${renderTagIcon(primaryEl.iconKey)}
                      </span>`
                    : ""
                }
              </div>

              <div class="fu-banner-rank-title">
                ${badgesHtml}
              </div>

              <div class="fu-banner-divider"></div>

              <div class="fu-banner-stats-rows">
                <div class="fu-banner-stat-bar">
                  <span>Custo de PM</span>
                  <strong>${sp.mpCost} PM</strong>
                </div>
                <div class="fu-banner-stat-bar">
                  <span>Alvo</span>
                  <strong>${sp.targetLabel}</strong>
                </div>
              </div>

              <div class="fu-banner-desc-scroll">
                ${formatFUDescription(sp.description)}
              </div>

              <button
                type="button"
                class="fu-banner-select-btn"
                data-spell-uuid="${sp.uuid}"
                ${sp.alreadyKnown ? "disabled" : ""}
              >
                ${
                  sp.alreadyKnown
                    ? "Já Aprendido"
                    : selection.willReachMastery
                    ? "Aprender & Escolher Heróico"
                    : "Aprender Feitiço"
                }
              </button>
            </div>
          </div>
        `;
      })
      .join("");

    return `
      <div class="fu-class-picker-modal" id="fu-spell-picker-modal">
        <div class="fu-class-picker-box fu-banner-modal-box">
          <div class="fu-picker-header">
            <div>
              <h3>Grimório de Feitiços — ${selection.className}</h3>
              <p>Poder selecionado: <strong>${selection.skillName}</strong>. Escolha 1 feitiço para adicionar à ficha:</p>
            </div>
            <button type="button" class="fu-spell-toggle-all-btn" id="fu-spell-toggle-all">
              ${showAllSpells ? "Filtrar pela Classe" : "Mostrar Todos os Feitiços"}
            </button>
            <input type="search" id="fu-spell-search-input" placeholder="Buscar feitiço..." />
            <button type="button" class="fu-picker-close-btn" id="fu-spell-picker-close" title="Voltar"><i class="fas fa-times"></i></button>
          </div>
          <div class="fu-banner-cards-grid">
            ${bannersHtml || "<p>Nenhum feitiço encontrado nos compêndios.</p>"}
          </div>
        </div>
      </div>
    `;
  }

  /* ==========================================================================
   * MODAL PODERES HERÓICOS (TODOS OS 8 EXCLUSIVOS + GENÉRICOS)
   * ========================================================================== */
  getHeroicSkillsForClass(classFuid, className) {
    const ownedHeroics = this.actor.items.filter((i) => i.type === "heroic");
    const ownedKeys = new Set(
      ownedHeroics
        .flatMap((h) => [(h.system?.fuid || "").trim().toLowerCase(), h.name.trim().toLowerCase()])
        .filter(Boolean)
    );

    const normTargetFuid = normalizeTextKey(classFuid);
    const normTargetName = normalizeTextKey(className);

    // Conjuntos de aliases conhecidas de classes para cobrir suplementos em PT/EN
    const classAliases = new Set([normTargetFuid, normTargetName].filter(Boolean));
    const aliasPairs = [
      ["wayfarer", "andarilho"],
      ["elementalist", "elementalista"],
      ["entropist", "entropista"],
      ["spiritist", "espiritualista"],
      ["arcanist", "arcanista"],
      ["chimerist", "quimerista"],
      ["darkblade", "lamina sombria", "lâmina sombria"],
      ["fury", "furia", "fúria"],
      ["guardian", "guardiao", "guardião"],
      ["loremaster", "erudito"],
      ["orator", "orador"],
      ["rogue", "ladino"],
      ["sharpshooter", "atirador"],
      ["tinkerer", "engenhoqueiro"],
      ["weaponmaster", "mestre de armas"],
      ["chanter", "cantor"],
      ["commander", "comandante"],
      ["dancer", "dancarino", "dançarino"],
      ["symbolist", "simbolista"],
      ["esper", "esper"],
      ["mutant", "mutante"],
      ["pilot", "piloto"],
      ["floralist", "floralista"],
      ["gourmet", "gourmet"],
      ["invoker", "invocador"],
      ["merchant", "mercador"]
    ];

    for (const group of aliasPairs) {
      if (group.some((alias) => classAliases.has(normalizeTextKey(alias)))) {
        for (const alias of group) {
          classAliases.add(normalizeTextKey(alias));
        }
      }
    }

    const exclusive = [];
    const generic = [];

    for (const hDoc of this.catalog.heroicSkills) {
      const fuid = (hDoc.system?.fuid || "").trim().toLowerCase();
      const nameKey = hDoc.name.trim().toLowerCase();
      const alreadyKnown = (fuid && ownedKeys.has(fuid)) || ownedKeys.has(nameKey);

      const rawClassField = (hDoc.system?.class?.value ?? hDoc.system?.class ?? "").toString();
      const normClassField = normalizeTextKey(rawClassField);
      const requirementRaw = (hDoc.system?.requirement?.value || "").trim();
      const normReq = normalizeTextKey(requirementRaw);

      const mapped = {
        doc: hDoc,
        uuid: hDoc.uuid,
        name: hDoc.name,
        img: hDoc.img,
        alreadyKnown,
        requirement: requirementRaw,
        description: hDoc.system?.description || ""
      };

      const matchesClassField =
        normClassField &&
        Array.from(classAliases).some(
          (alias) => normClassField === alias || normClassField.includes(alias)
        );

      const matchesRequirementField =
        (!normClassField || normClassField === "none" || normClassField === "generic") &&
        normReq &&
        Array.from(classAliases).some((alias) => {
          const esc = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          return new RegExp(`(?:^|[^a-z0-9])${esc}(?:$|[^a-z0-9])`).test(normReq);
        });

      if (matchesClassField || matchesRequirementField) {
        exclusive.push(mapped);
      } else if (!normClassField || normClassField === "none" || normClassField === "generic") {
        // Verifica se não é exclusivo de outra classe citado no requisito
        const isOtherClassExclusive = aliasPairs.some((group) => {
          if (group.some((alias) => classAliases.has(normalizeTextKey(alias)))) return false;
          return group.some((otherAlias) => {
            const esc = normalizeTextKey(otherAlias).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            return new RegExp(`(?:^|[^a-z0-9])${esc}(?:$|[^a-z0-9])`).test(normReq);
          });
        });

        if (!isOtherClassExclusive) {
          generic.push(mapped);
        }
      }
    }

    return { exclusive, generic };
  }

  buildHeroicPickerHTML({ selection, standaloneClass, activeTab }) {
    const targetClassFuid = selection ? selection.classFuid : standaloneClass.fuid;
    const targetClassName = selection ? selection.className : standaloneClass.name;

    const { exclusive, generic } = this.getHeroicSkillsForClass(targetClassFuid, targetClassName);
    const currentList = activeTab === "exclusive" ? exclusive : generic;

    const cardsHtml = currentList
      .map(
        (h) => `
        <div class="fu-heroic-card ${h.alreadyKnown ? "is-known" : ""}" data-search="${h.name.toLowerCase()}">
          <div class="fu-heroic-card-top">
            <img src="${h.img}" alt="${h.name}" />
            <div>
              <span class="fu-heroic-type-badge">
                ${activeTab === "exclusive" ? `👑 Exclusivo • ${targetClassName}` : "✦ Poder Heróico Genérico"}
              </span>
              <h4>${h.name}</h4>
            </div>
            ${h.alreadyKnown ? `<span class="fu-spell-known-badge">Já Adquirido</span>` : ""}
          </div>

          ${
            h.requirement
              ? `<div class="fu-heroic-req"><strong>Requisito:</strong> ${h.requirement}</div>`
              : ""
          }

          <div class="fu-heroic-card-desc">
            ${formatFUDescription(h.description)}
          </div>

          <button
            type="button"
            class="fu-choose-heroic-btn"
            data-heroic-uuid="${h.uuid}"
            ${h.alreadyKnown ? "disabled" : ""}
          >
            ${h.alreadyKnown ? "Poder Heróico já adquirido" : "Escolher Poder Heróico"}
          </button>
        </div>
      `
      )
      .join("");

    return `
      <div class="fu-class-picker-modal" id="fu-heroic-picker-modal">
        <div class="fu-class-picker-box fu-heroic-modal-box">
          <div class="fu-picker-header">
            <div>
              <h3><i class="fas fa-crown"></i> Maestria em ${targetClassName} (10/10) — Poder Heróico</h3>
              <p>Escolha <strong>1 Poder Heróico Exclusivo de ${targetClassName}</strong> ou <strong>1 Poder Heróico Genérico</strong>:</p>
            </div>
            <input type="search" id="fu-heroic-search-input" placeholder="Buscar poder heróico..." />
            <button type="button" class="fu-picker-close-btn" id="fu-heroic-picker-close" title="Voltar"><i class="fas fa-times"></i></button>
          </div>

          <div class="fu-heroic-tabs-bar">
            <button type="button" class="fu-heroic-tab-btn ${activeTab === "exclusive" ? "is-active" : ""}" data-tab="exclusive">
              <i class="fas fa-crown"></i> Exclusivos de ${targetClassName} (${exclusive.length})
            </button>
            <button type="button" class="fu-heroic-tab-btn ${activeTab === "generic" ? "is-active" : ""}" data-tab="generic">
              <i class="fas fa-star"></i> Poderes Heróicos Genéricos (${generic.length})
            </button>
          </div>

          <div class="fu-heroic-cards-grid">
            ${
              cardsHtml ||
              `<p class="fu-empty-heroic-msg">Nenhum poder heróico encontrado nesta categoria. Experimente a outra aba acima.</p>`
            }
          </div>
        </div>
      </div>
    `;
  }

  /* ==========================================================================
   * MODAL ESCOLHER NOVA CLASSE (CARDS MARROM-DOURADOS)
   * ========================================================================== */
  buildClassPickerHTML(ownedClassesData) {
    const ownedFuids = new Set(ownedClassesData.map((c) => c.fuid));
    const available = this.catalog.classes.filter((c) => {
      const fuid = (c.system?.fuid || c.name).trim().toLowerCase();
      return !ownedFuids.has(fuid);
    });

    const cardsHtml = available
      .map((cls) => {
        const fuid = (cls.system?.fuid || cls.name).trim().toLowerCase();
        const brief = getClassBriefDescription(cls);
        const benefitTag = getClassShortBenefitTag(cls);

        return `
          <div class="fu-brown-class-card" data-search="${cls.name.toLowerCase()}">
            <div class="fu-brown-card-inner">
              <div class="fu-brown-diamond-crest">
                <div class="fu-brown-diamond-inner">
                  <img src="${cls.img}" alt="${cls.name}" />
                </div>
              </div>

              <h4 class="fu-brown-class-title">${cls.name}</h4>

              <p class="fu-brown-class-desc">${brief}</p>

              <div class="fu-brown-ornament-chevron">
                <span>❖</span>
              </div>

              <div class="fu-brown-benefit-line">${benefitTag}</div>

              <button type="button" class="fu-brown-choose-btn" data-class-fuid="${fuid}">
                Escolher Classe
              </button>
            </div>
          </div>
        `;
      })
      .join("");

    return `
      <div class="fu-class-picker-modal" id="fu-class-picker-modal">
        <div class="fu-class-picker-box fu-brown-modal-shell">
          <div class="fu-picker-header">
            <div>
              <h3>Escolher Nova Classe (${ownedClassesData.length + 1} de ${MAX_CLASSES})</h3>
              <p>Escolha uma classe para expandir sua árvore radial de poderes:</p>
            </div>
            <input type="search" id="fu-class-search-input" placeholder="Buscar classe..." />
            <button type="button" class="fu-picker-close-btn" id="fu-class-picker-close" title="Fechar"><i class="fas fa-times"></i></button>
          </div>
          <div class="fu-brown-cards-grid" id="fu-picker-grid">
            ${cardsHtml || "<p>Nenhuma classe adicional encontrada nos compêndios.</p>"}
          </div>
        </div>
      </div>
    `;
  }

  async closeClassPickerAnimated() {
    const modal = document.getElementById("fu-class-picker-modal");
    if (modal) {
      modal.classList.add("is-closing");
      await new Promise((r) => setTimeout(r, 240));
    }
    this.classPickerOpen = false;
    this.renderTreeStage();
  }

  showSkillHint(skill, cls, clientX, clientY) {
    this.removeHintElement();
    this.activeHint = skill;

    const hint = document.createElement("div");
    hint.id = "fu-skill-hint-popover";
    hint.innerHTML = `
      <div class="fu-hint-header">
        <img src="${skill.img}" alt="${skill.name}" />
        <div>
          <span class="fu-hint-class">${cls.name}</span>
          <h4>${skill.name}</h4>
        </div>
        <span class="fu-hint-np">NP ${skill.currentRank}/${skill.maxRank}</span>
        <button type="button" class="fu-hint-close"><i class="fas fa-times"></i></button>
      </div>
      <div class="fu-hint-body">
        ${formatFUDescription(skill.description)}
      </div>
    `;

    this.root.appendChild(hint);

    const rect = hint.getBoundingClientRect();
    const left = Math.min(window.innerWidth - rect.width - 20, Math.max(16, clientX + 14));
    const top = Math.min(window.innerHeight - rect.height - 20, Math.max(70, clientY - 20));
    hint.style.left = `${left}px`;
    hint.style.top = `${top}px`;

    hint.querySelector(".fu-hint-close").onclick = () => this.removeHintElement();
  }

  showSpellBranchHint(spellItem, parentSkill, elements, clientX, clientY) {
    this.removeHintElement();
    this.activeHint = spellItem;

    const mpCost = spellItem.system?.cost?.amount || spellItem.system?.mpCost?.value || "0";
    const elementsHtml = elements
      .map(
        (el) => `
        <span class="fu-el-pill" style="color: ${el.color}; background: ${el.bg}; border-color: ${el.border};">
          ${renderTagIcon(el.iconKey)} ${el.label}
        </span>
      `
      )
      .join("");

    const hint = document.createElement("div");
    hint.id = "fu-skill-hint-popover";
    hint.innerHTML = `
      <div class="fu-hint-header">
        <img src="${spellItem.img}" alt="${spellItem.name}" />
        <div>
          <span class="fu-hint-class">Feitiço • ${parentSkill.name}</span>
          <h4>${spellItem.name}</h4>
        </div>
        <span class="fu-hint-np">${mpCost} PM</span>
        <button type="button" class="fu-hint-close"><i class="fas fa-times"></i></button>
      </div>
      ${elementsHtml ? `<div class="fu-hint-elements-row">${elementsHtml}</div>` : ""}
      <div class="fu-hint-body">
        ${formatFUDescription(spellItem.system?.description || "")}
      </div>
    `;

    this.root.appendChild(hint);

    const rect = hint.getBoundingClientRect();
    const left = Math.min(window.innerWidth - rect.width - 20, Math.max(16, clientX + 14));
    const top = Math.min(window.innerHeight - rect.height - 20, Math.max(70, clientY - 20));
    hint.style.left = `${left}px`;
    hint.style.top = `${top}px`;

    hint.querySelector(".fu-hint-close").onclick = () => this.removeHintElement();
  }

  removeHintElement() {
    const existing = document.getElementById("fu-skill-hint-popover");
    if (existing) existing.remove();
    this.activeHint = null;
  }

  bindTreeEvents() {
    const viewport = this.root.querySelector("#fu-tree-viewport");
    const canvasEl = this.root.querySelector("#fu-tree-canvas");

    this.root.querySelector(".fu-tree-back-btn").onclick = () => this.renderRevealStage();

    this.root.querySelector(".fu-tree-reset-cam").onclick = () => {
      this.pan = { x: 0, y: 0 };
      this.zoom = 1;
      canvasEl.classList.add("is-smooth-dezoom");
      canvasEl.style.transform = `translate3d(0px, 0px, 0) scale(1)`;
      setTimeout(() => canvasEl.classList.remove("is-smooth-dezoom"), 720);
    };

    viewport.addEventListener("contextmenu", (ev) => {
      ev.preventDefault();
    });

    viewport.addEventListener("mousedown", (ev) => {
      if (ev.button === 2) {
        this.isRightDragging = true;
        this.dragStart = { x: ev.clientX - this.pan.x, y: ev.clientY - this.pan.y };
        viewport.classList.add("is-grabbing");
      } else if (ev.button === 0) {
        this.removeHintElement();
      }
    });

    viewport.addEventListener(
      "wheel",
      (ev) => {
        if (this.inspectedSkill || this.classPickerOpen || this.spellPickerContext || this.heroicPickerContext) return;
        ev.preventDefault();
        const delta = ev.deltaY > 0 ? -0.08 : 0.08;
        this.zoom = Math.min(1.6, Math.max(0.5, Number((this.zoom + delta).toFixed(2))));
        canvasEl.style.transform = `translate3d(${this.pan.x}px, ${this.pan.y}px, 0) scale(${this.zoom})`;
      },
      { passive: false }
    );

    const newClassBtn = this.root.querySelector(".fu-new-class-btn");
    if (newClassBtn) {
      newClassBtn.onclick = () => {
        this.classPickerOpen = true;
        this.renderTreeStage();
      };
    }

    const cancelStagedBtn = this.root.querySelector(".fu-cancel-staged-class-btn");
    if (cancelStagedBtn) {
      cancelStagedBtn.onclick = () => {
        this.stagedNewClass = null;
        this.classPickerOpen = true;
        this.renderTreeStage();
      };
    }

    if (this.classPickerOpen) {
      const classModal = this.root.querySelector("#fu-class-picker-modal");
      classModal?.addEventListener("click", (ev) => {
        if (ev.target === classModal) this.closeClassPickerAnimated();
      });

      this.root.querySelector("#fu-class-picker-close")?.addEventListener("click", () => {
        this.closeClassPickerAnimated();
      });

      const searchInput = this.root.querySelector("#fu-class-search-input");
      searchInput?.addEventListener("input", (ev) => {
        const q = ev.target.value.trim().toLowerCase();
        this.root.querySelectorAll(".fu-brown-class-card").forEach((card) => {
          card.style.display = card.dataset.search.includes(q) ? "" : "none";
        });
      });

      this.root.querySelectorAll(".fu-brown-choose-btn").forEach((btn) => {
        btn.onclick = async () => {
          const classFuid = btn.dataset.classFuid;
          const classDoc = this.catalog.classes.find(
            (c) => (c.system?.fuid || c.name).trim().toLowerCase() === classFuid
          );
          if (!classDoc) return;

          const modal = document.getElementById("fu-class-picker-modal");
          if (modal) {
            modal.classList.add("is-closing");
            await new Promise((r) => setTimeout(r, 240));
          }

          this.stagedNewClass = classDoc;
          this.animateStagedSpawn = true;
          this.classPickerOpen = false;
          this.renderTreeStage();
        };
      });
    }

    if (this.inspectedSkill) {
      const showcaseBackdrop = this.root.querySelector("#fu-skill-showcase-backdrop");
      showcaseBackdrop?.addEventListener("click", (ev) => {
        if (ev.target === showcaseBackdrop) {
          this.closeSkillShowcase();
        }
      });

      this.root.querySelector("#fu-showcase-cancel-btn")?.addEventListener("click", () => {
        this.closeSkillShowcase();
      });

      const confirmBtn = this.root.querySelector("#fu-showcase-confirm-btn");
      if (confirmBtn && !confirmBtn.disabled) {
        confirmBtn.onclick = async () => {
          const { cls, skill } = this.inspectedSkill;
          const willReachMastery = cls.investedPoints + 1 === MAX_SKILLS_PER_CLASS && !cls.claimedHeroicItem;

          const selection = {
            isNewClass: cls.isStaged,
            actorClassItem: cls.actorItem,
            classDoc: cls.compendiumDoc,
            className: cls.name,
            classFuid: cls.fuid,
            skillDoc: skill.poolDoc,
            actorSkillItem: skill.actorItem,
            skillName: skill.name,
            skillFuid: skill.fuid,
            currentRank: skill.currentRank,
            maxRank: skill.maxRank,
            willReachMastery,
            spellDoc: null,
            heroicDoc: null
          };

          if (skill.grantsSpell) {
            this.inspectedSkill = null;
            this.spellPickerContext = { selection, showAllSpells: false };
            this.renderTreeStage();
            return;
          }

          if (willReachMastery) {
            this.inspectedSkill = null;
            this.heroicPickerContext = { selection, standaloneClass: null, activeTab: "exclusive" };
            this.renderTreeStage();
            return;
          }

          confirmBtn.disabled = true;

          const backdrop = this.root.querySelector("#fu-skill-showcase-backdrop");
          if (backdrop) {
            backdrop.classList.add("is-confirm-exiting");
          }

          await Promise.all([
            this.commitAdvancement(selection),
            new Promise((r) => setTimeout(r, 210))
          ]);
        };
      }
    }

    if (this.spellPickerContext) {
      const spellModal = this.root.querySelector("#fu-spell-picker-modal");
      spellModal?.addEventListener("click", (ev) => {
        if (ev.target === spellModal) {
          this.spellPickerContext = null;
          this.closeSkillShowcase();
        }
      });

      this.root.querySelector("#fu-spell-picker-close")?.addEventListener("click", () => {
        this.spellPickerContext = null;
        this.closeSkillShowcase();
      });

      this.root.querySelector("#fu-spell-toggle-all")?.addEventListener("click", () => {
        this.spellPickerContext.showAllSpells = !this.spellPickerContext.showAllSpells;
        this.renderTreeStage();
      });

      const spellSearch = this.root.querySelector("#fu-spell-search-input");
      spellSearch?.addEventListener("input", (ev) => {
        const q = ev.target.value.trim().toLowerCase();
        this.root.querySelectorAll(".fu-banner-spell-card").forEach((card) => {
          card.style.display = card.dataset.search.includes(q) ? "" : "none";
        });
      });

      this.root.querySelectorAll(".fu-banner-select-btn").forEach((btn) => {
        btn.onclick = async () => {
          if (btn.disabled) return;
          btn.disabled = true;
          const spellUuid = btn.dataset.spellUuid;
          const spellDoc = this.catalog.spells.find((s) => s.uuid === spellUuid);
          if (!spellDoc) return;

          const selection = {
            ...this.spellPickerContext.selection,
            spellDoc
          };

          if (selection.willReachMastery) {
            this.spellPickerContext = null;
            this.heroicPickerContext = { selection, standaloneClass: null, activeTab: "exclusive" };
            this.renderTreeStage();
            return;
          }

          await this.commitAdvancement(selection);
        };
      });
    }

    if (this.heroicPickerContext) {
      const heroicModal = this.root.querySelector("#fu-heroic-picker-modal");
      heroicModal?.addEventListener("click", (ev) => {
        if (ev.target === heroicModal) {
          this.heroicPickerContext = null;
          this.closeSkillShowcase();
        }
      });

      this.root.querySelector("#fu-heroic-picker-close")?.addEventListener("click", () => {
        this.heroicPickerContext = null;
        this.closeSkillShowcase();
      });

      this.root.querySelectorAll(".fu-heroic-tab-btn").forEach((tabBtn) => {
        tabBtn.onclick = () => {
          this.heroicPickerContext.activeTab = tabBtn.dataset.tab;
          this.renderTreeStage();
        };
      });

      const heroicSearch = this.root.querySelector("#fu-heroic-search-input");
      heroicSearch?.addEventListener("input", (ev) => {
        const q = ev.target.value.trim().toLowerCase();
        this.root.querySelectorAll(".fu-heroic-card").forEach((card) => {
          card.style.display = card.dataset.search.includes(q) ? "" : "none";
        });
      });

      this.root.querySelectorAll(".fu-choose-heroic-btn").forEach((btn) => {
        btn.onclick = async () => {
          if (btn.disabled) return;
          btn.disabled = true;
          const heroicUuid = btn.dataset.heroicUuid;
          const heroicDoc = this.catalog.heroicSkills.find((h) => h.uuid === heroicUuid);
          if (!heroicDoc) return;

          if (this.heroicPickerContext.selection) {
            const selection = {
              ...this.heroicPickerContext.selection,
              heroicDoc
            };
            await this.commitAdvancement(selection);
          } else if (this.heroicPickerContext.standaloneClass) {
            await this.commitStandaloneHeroic(this.heroicPickerContext.standaloneClass, heroicDoc);
          }
        };
      });
    }
  }

  async commitStandaloneHeroic(cls, heroicDoc) {
    try {
      const heroicData = heroicDoc.toObject();
      delete heroicData._id;
      const [createdHeroic] = await this.actor.createEmbeddedDocuments("Item", [heroicData]);

      const advancements = foundry.utils.deepClone(this.actor.system?.advancements ?? []);
      const ownedSkillIds = new Set(cls.skills.map((s) => s.actorItem?.id).filter(Boolean));

      let targetIndex = -1;
      for (let i = advancements.length - 1; i >= 0; i--) {
        if (ownedSkillIds.has(advancements[i]?.skill?.id)) {
          targetIndex = i;
          break;
        }
      }

      if (targetIndex >= 0) {
        advancements[targetIndex].entries = {
          ...(advancements[targetIndex].entries || {}),
          heroic: {
            id: createdHeroic.id,
            locked: false
          }
        };
        await this.actor.update({ "system.advancements": advancements });
      }

      ui.notifications.info(`${this.actor.name} adquiriu o Poder Heróico: ${heroicDoc.name}!`);
      this.heroicPickerContext = null;
      this.renderTreeStage();
    } catch (err) {
      console.error("fu-level-up-wizard | Erro ao aplicar Poder Heróico:", err);
      ui.notifications.error("Erro ao salvar o Poder Heróico. Verifique o console (F12).");
    }
  }

  async commitAdvancement(selection) {
    try {
      let embeddedClassId = selection.actorClassItem?.id ?? null;
      let isNewClassEntry = false;

      if (selection.isNewClass) {
        const classData = selection.classDoc.toObject();
        delete classData._id;
        const [createdClass] = await this.actor.createEmbeddedDocuments("Item", [classData]);
        embeddedClassId = createdClass.id;
        isNewClassEntry = true;
      }

      let embeddedSkillId = selection.actorSkillItem?.id ?? null;
      let newSkillRank = 1;
      const maxSkillRank = selection.maxRank;

      if (selection.actorSkillItem) {
        newSkillRank = Math.min(maxSkillRank, Number(selection.actorSkillItem.system?.level?.value ?? 0) + 1);
        await selection.actorSkillItem.update({ "system.level.value": newSkillRank });
        embeddedSkillId = selection.actorSkillItem.id;
      } else {
        const skillData = selection.skillDoc.toObject();
        delete skillData._id;
        foundry.utils.setProperty(skillData, "system.level.value", 1);
        const [createdSkill] = await this.actor.createEmbeddedDocuments("Item", [skillData]);
        embeddedSkillId = createdSkill.id;
        newSkillRank = 1;
      }

      let embeddedSpellId = null;
      if (selection.spellDoc) {
        const spellData = selection.spellDoc.toObject();
        delete spellData._id;
        const [createdSpell] = await this.actor.createEmbeddedDocuments("Item", [spellData]);
        embeddedSpellId = createdSpell.id;
      }

      let embeddedHeroicId = null;
      if (selection.heroicDoc) {
        const heroicData = selection.heroicDoc.toObject();
        delete heroicData._id;
        const [createdHeroic] = await this.actor.createEmbeddedDocuments("Item", [heroicData]);
        embeddedHeroicId = createdHeroic.id;
      }

      const entries = {};
      if (embeddedSpellId) {
        entries.spell = { id: embeddedSpellId, locked: false };
      }
      if (embeddedHeroicId) {
        entries.heroic = { id: embeddedHeroicId, locked: false };
      }

      const advancements = foundry.utils.deepClone(this.actor.system?.advancements ?? []);
      const newEntry = {
        class: isNewClassEntry
          ? { id: embeddedClassId, locked: false }
          : { locked: true },
        skill: {
          id: embeddedSkillId,
          value: newSkillRank,
          max: maxSkillRank
        },
        entries
      };

      const emptyIndex = advancements.findIndex((adv) => !adv?.skill?.id);
      if (emptyIndex >= 0) {
        advancements[emptyIndex] = newEntry;
      } else {
        advancements.push(newEntry);
      }

      await this.actor.update({ "system.advancements": advancements });

      const spellSuffix = selection.spellDoc ? ` + Feitiço: ${selection.spellDoc.name}` : "";
      const heroicSuffix = selection.heroicDoc ? ` + Poder Heróico: ${selection.heroicDoc.name}` : "";
      ui.notifications.info(
        `${this.actor.name}: ${selection.className} — ${selection.skillName} (NP ${newSkillRank}/${maxSkillRank})${spellSuffix}${heroicSuffix} aplicado!`
      );

      const zoomedPan = { ...this.pan };
      const zoomedScale = this.zoom;

      this.recentUpgradeAnim = {
        classFuid: selection.classFuid,
        skillFuid: selection.skillFuid,
        newRank: newSkillRank,
        newSpellId: embeddedSpellId
      };

      this.inspectedSkill = null;
      this.spellPickerContext = null;
      this.heroicPickerContext = null;
      this.stagedNewClass = null;

      if (this.savedCamera) {
        this.pan = { ...this.savedCamera.pan };
        this.zoom = this.savedCamera.zoom;
        this.savedCamera = null;
      } else {
        this.pan = { x: 0, y: 0 };
        this.zoom = 1;
      }

      this.pendingDezoomTransition = {
        fromPan: zoomedPan,
        fromZoom: zoomedScale,
        toPan: { ...this.pan },
        toZoom: this.zoom
      };

      refreshTopCenterTrigger(this.actor);

      const remaining = getPendingLevelInfo(this.actor).pending;
      this.renderTreeStage();

      if (remaining <= 0) {
        await new Promise((r) => setTimeout(r, 950));
        await this.closeWithAnimation(true);
      }
    } catch (err) {
      console.error("fu-level-up-wizard | Erro ao aplicar avanço de nível:", err);
      ui.notifications.error("Erro ao salvar o avanço de nível. Verifique o console (F12).");
    }
  }
}
