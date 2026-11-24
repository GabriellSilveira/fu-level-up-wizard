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

const ELEMENT_META = {
  fire: { label: "Fogo", icon: "🔥", color: "#f97316", bg: "rgba(249, 115, 22, 0.22)", border: "rgba(249, 115, 22, 0.55)" },
  ice: { label: "Gelo", icon: "❄️", color: "#38bdf8", bg: "rgba(56, 189, 248, 0.22)", border: "rgba(56, 189, 248, 0.55)" },
  bolt: { label: "Raio", icon: "⚡", color: "#facc15", bg: "rgba(250, 204, 21, 0.22)", border: "rgba(250, 204, 21, 0.55)" },
  earth: { label: "Terra", icon: "🪨", color: "#a3e635", bg: "rgba(132, 204, 22, 0.2)", border: "rgba(132, 204, 22, 0.5)" },
  air: { label: "Ar", icon: "🌪️", color: "#34d399", bg: "rgba(52, 211, 153, 0.2)", border: "rgba(52, 211, 153, 0.5)" },
  light: { label: "Luz", icon: "✨", color: "#fef08a", bg: "rgba(254, 240, 138, 0.22)", border: "rgba(254, 240, 138, 0.55)" },
  dark: { label: "Trevas", icon: "🌑", color: "#c084fc", bg: "rgba(192, 132, 252, 0.22)", border: "rgba(192, 132, 252, 0.55)" },
  poison: { label: "Veneno", icon: "☠️", color: "#a855f7", bg: "rgba(168, 85, 247, 0.22)", border: "rgba(168, 85, 247, 0.55)" }
};

const EFFECT_LABELS = {
  slow: { label: "Lento", icon: "🐢" },
  dazed: { label: "Confuso", icon: "💫" },
  weak: { label: "Fraco", icon: "💔" },
  shaken: { label: "Abalado", icon: "😰" },
  enraged: { label: "Enfurecido", icon: "💢" },
  poisoned: { label: "Envenenado", icon: "☠️" },
  crisis: { label: "Crise", icon: "⚠️" },
  guard: { label: "Protegido", icon: "🛡️" },
  flying: { label: "Voando", icon: "🕊️" }
};

/**
 * Calcula quantos níveis o personagem possui e quantos avanços já estão preenchidos.
 */
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

/**
 * Limpa tags @ICON[...], @EFFECT[...], @GAIN[...], @LOSS[...], @DMG[...] e @UUID[...] do projectfu.
 */
function formatFUDescription(rawHtml = "") {
  if (!rawHtml) return "<p>Sem descrição disponível.</p>";
  return rawHtml
    .replace(/@ICON\[([^\]]+)\]/gi, (_, iconName) => {
      const map = {
        offensive: "⚡ Ofensivo",
        spell: "✦ Feitiço",
        melee: "⚔ Corpo a Corpo",
        ranged: "🏹 À Distância",
        martial: "🛡 Marcial",
        fire: "🔥 Fogo",
        ice: "❄️ Gelo",
        bolt: "⚡ Raio",
        lightning: "⚡ Raio",
        earth: "🪨 Terra",
        air: "🌪️ Ar",
        wind: "🌪️ Ar",
        light: "✨ Luz",
        dark: "🌑 Trevas",
        poison: "☠️ Veneno"
      };
      return `<span class="fu-inline-tag">${map[iconName.toLowerCase()] || iconName}</span>`;
    })
    .replace(/@EFFECT\[([^\]]+)\](?:\{([^}]+)\}|\[([^\]]+)\])?/gi, (_, effKey, curlyLabel, bracketLabel) => {
      const key = effKey.trim().toLowerCase();
      const found = EFFECT_LABELS[key];
      const text = curlyLabel || bracketLabel || (found ? found.label : effKey);
      const icon = found ? found.icon : "✦";
      return `<span class="fu-inline-effect">${icon} ${text}</span>`;
    })
    .replace(/@(?:GAIN|LOSS|DMG)\[([^\]]+)\](?:\{([^}]+)\}|\[([^\]]+)\])?/gi, (_, expr, curlyLabel, bracketLabel) => {
      const label = curlyLabel || bracketLabel || expr;
      return `<strong>${label}</strong>`;
    })
    .replace(/@UUID\[([^\]]+)\](?:\{([^}]+)\})?/g, (_, _uuid, label) => {
      return `<strong>${label || "Referência"}</strong>`;
    });
}

/**
 * Detecta os tipos de dano elemental de um feitiço a partir dos dados e da descrição.
 */
function detectSpellElements(spellDoc) {
  const found = [];
  const addUnique = (key) => {
    if (ELEMENT_META[key] && !found.some((item) => item.key === key)) {
      found.push({ key, ...ELEMENT_META[key] });
    }
  };

  const dmgType = (spellDoc?.system?.damage?.type || "").toLowerCase();
  if (dmgType === "fire") addUnique("fire");
  if (dmgType === "ice") addUnique("ice");
  if (dmgType === "bolt" || dmgType === "lightning") addUnique("bolt");
  if (dmgType === "earth") addUnique("earth");
  if (dmgType === "air" || dmgType === "wind") addUnique("air");
  if (dmgType === "light") addUnique("light");
  if (dmgType === "dark") addUnique("dark");
  if (dmgType === "poison") addUnique("poison");

  const plainDesc = (spellDoc?.system?.description || "")
    .replace(/<[^>]+>/g, " ")
    .toLowerCase();

  if (/\bdano de fogo\b|\bfogo dano\b|\bfire damage\b/.test(plainDesc)) addUnique("fire");
  if (/\bdano de gelo\b|\bgelo dano\b|\bice damage\b/.test(plainDesc)) addUnique("ice");
  if (/\bdano de raio\b|\braio dano\b|\bbolt damage\b|\blightning damage\b/.test(plainDesc)) addUnique("bolt");
  if (/\bdano de terra\b|\bterra dano\b|\bearth damage\b/.test(plainDesc)) addUnique("earth");
  if (/\bdano de ar\b|\bar dano\b|\bvento\b|\bair damage\b|\bwind damage\b/.test(plainDesc)) addUnique("air");
  if (/\bdano de luz\b|\bluz dano\b|\blight damage\b/.test(plainDesc)) addUnique("light");
  if (/\bdano de trevas\b|\btrevas dano\b|\bsombra\b|\bdark damage\b/.test(plainDesc)) addUnique("dark");
  if (/\bdano de veneno\b|\bveneno dano\b|\bpoison damage\b/.test(plainDesc)) addUnique("poison");

  return found;
}

/**
 * Extrai uma descrição breve e limpa da classe para o card marrom-dourado.
 */
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

/**
 * Gera resumo curto dos benefícios gratuitos da classe.
 */
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

/**
 * Verifica se uma perícia concede escolha de feitiço (ex.: Magia Elemental).
 */
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

    // Estado da câmera da árvore radial (pan & zoom)
    this.pan = { x: 0, y: 0 };
    this.zoom = 1;
    this.savedCamera = null;
    this.isRightDragging = false;
    this.dragStart = { x: 0, y: 0 };

    // Estados de seleção
    this.stagedNewClass = null;
    this.animateStagedSpawn = false;
    this.inspectedSkill = null;      // { cls, skill }
    this.spellPickerContext = null;  // { selection, showAllSpells }
    this.heroicPickerContext = null; // { selection, activeTab: "exclusive" | "generic", standaloneClass: null }
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

  /**
   * Carrega Classes, Perícias, Feitiços e Poderes Heróicos dos compêndios relevantes.
   */
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

        return {
          poolDoc: poolSkill,
          actorItem: actorSkill || null,
          name: poolSkill.name,
          img: poolSkill.img,
          fuid: poolFuid,
          currentRank,
          maxRank,
          description: poolSkill.system?.description || "",
          grantsSpell: doesSkillGrantSpell(poolSkill)
        };
      });

      const investedPoints = skills.reduce((sum, s) => sum + s.currentRank, 0);
      const isMastered = investedPoints >= MAX_SKILLS_PER_CLASS;

      // Verifica se essa classe já reivindicou um Poder Heróico nos avanços
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
          grantsSpell: doesSkillGrantSpell(poolSkill)
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

    // Listeners globais registrados apenas uma vez para o pan com botão direito
    this._onWindowMouseMove = (ev) => {
      if (!this.isRightDragging) return;
      this.pan.x = ev.clientX - this.dragStart.x;
      this.pan.y = ev.clientY - this.dragStart.y;
      const canvasEl = this.root?.querySelector("#fu-tree-canvas");
      if (canvasEl) {
        canvasEl.style.transform = `translate(${this.pan.x}px, ${this.pan.y}px) scale(${this.zoom})`;
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
      await new Promise((r) => setTimeout(r, 650));
    }

    if (this.root) {
      this.root.classList.add("is-closing");
      await new Promise((r) => setTimeout(r, 520));
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
              <button type="button" class="fu-btn-open-tree">
                <span class="fu-btn-icon"><i class="fas fa-project-diagram"></i></span>
                <span class="fu-btn-label">Escolher Classe e Habilidades</span>
                <span class="fu-btn-arrow"><i class="fas fa-arrow-right"></i></span>
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    this.root.querySelector(".fu-overlay-close-btn").onclick = () => this.closeWithAnimation(false);
    this.root.querySelector(".fu-btn-open-tree").onclick = () => {
      this.pan = { x: 0, y: 0 };
      this.zoom = 1;
      this.renderTreeStage();
    };
  }

  /* ==========================================================================
   * ETAPA 2: ÁRVORE RADIAL DE CLASSES E HABILIDADES
   * ========================================================================== */
  renderTreeStage() {
    this.stage = "tree";
    const info = getPendingLevelInfo(this.actor);
    const classesData = this.getActorClassesData();
    const canAddClass = classesData.length < MAX_CLASSES && !this.stagedNewClass;

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
            <div class="fu-tree-canvas" id="fu-tree-canvas" style="transform: translate(${this.pan.x}px, ${this.pan.y}px) scale(${this.zoom});">
              <svg class="fu-tree-lines-svg" id="fu-tree-lines-svg" width="2400" height="2400" viewBox="-1200 -1200 2400 2400"></svg>
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

    this.populateRadialTree(classesData, info);
    this.bindTreeEvents();

    this.animateStagedSpawn = false;
  }

  populateRadialTree(classesData, info) {
    const svg = this.root.querySelector("#fu-tree-lines-svg");
    const layer = this.root.querySelector("#fu-tree-nodes-layer");
    const parallaxLayer = this.root.querySelector("#fu-tree-parallax-layer");
    if (!svg || !layer) return;

    [135, 310, 420].forEach((radius) => {
      const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      circle.setAttribute("cx", "0");
      circle.setAttribute("cy", "0");
      circle.setAttribute("r", String(radius));
      circle.setAttribute("fill", "none");
      circle.setAttribute("stroke", "rgba(255, 255, 255, 0.05)");
      circle.setAttribute("stroke-width", "1");
      circle.setAttribute("stroke-dasharray", "4 8");
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

      const sectorDist = 135;
      const sx = Math.cos(baseAngle) * sectorDist;
      const sy = Math.sin(baseAngle) * sectorDist;

      this.appendSvgLine(svg, 0, 0, sx, sy, palette.primary, 3, true, cls.isStaged, shouldSpawnAnimate ? 0 : null);

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
      classNode.style.boxShadow = `0 0 22px ${palette.glow}, inset 0 0 14px ${palette.bg}`;
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

        const tierRadius = sIdx % 2 === 0 ? 310 : 420;
        const nx = Math.cos(skillAngle) * tierRadius;
        const ny = Math.sin(skillAngle) * tierRadius;

        const isUnlocked = skill.currentRank > 0;
        const isMaxed = skill.currentRank >= skill.maxRank;
        const isClassCapped = cls.investedPoints >= MAX_SKILLS_PER_CLASS;
        const canInvest = info.pending > 0 && !isMaxed && !isClassCapped;
        const spawnDelay = 120 + sIdx * 75;

        this.appendSvgLine(
          svg,
          sx,
          sy,
          nx,
          ny,
          isUnlocked ? palette.primary : "rgba(148, 163, 184, 0.3)",
          isUnlocked ? 2.5 : 1.5,
          isUnlocked,
          false,
          shouldSpawnAnimate ? spawnDelay : null
        );

        let dotsHtml = `<div class="fu-skill-dots">`;
        for (let d = 1; d <= skill.maxRank; d++) {
          const filledDot = d <= skill.currentRank;
          dotsHtml += `<span class="fu-dot ${filledDot ? "is-filled" : ""}"></span>`;
        }
        dotsHtml += `</div>`;

        const skillEl = document.createElement("div");
        skillEl.className = [
          "fu-skill-node",
          isUnlocked ? "is-unlocked" : "is-locked",
          isMaxed ? "is-maxed" : "",
          canInvest ? "is-investable" : "",
          shouldSpawnAnimate ? "fu-spawn-skill" : ""
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
          </div>
          ${dotsHtml}
          <span class="fu-skill-ratio">${skill.currentRank}/${skill.maxRank}</span>
          <span class="fu-skill-title">${skill.name}</span>
        `;

        // Efeito "Tela Viva": parallax suave na direção da habilidade no hover
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

        // Clique Esquerdo direto: abre imediatamente o Zoom + Modal de Seleção
        skillEl.addEventListener("click", (ev) => {
          ev.stopPropagation();
          this.openSkillShowcase(cls, skill, nx, ny);
        });

        // Clique Direito: hint rápido flutuante
        skillEl.addEventListener("contextmenu", (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          this.showSkillHint(skill, cls, ev.clientX, ev.clientY);
        });

        layer.appendChild(skillEl);
      });

      // Botão / Nó de Poder Heróico ao atingir 10 níveis na classe
      const heroicDist = 540;
      const hx = Math.cos(baseAngle) * heroicDist;
      const hy = Math.sin(baseAngle) * heroicDist;

      this.appendSvgLine(
        svg,
        sx,
        sy,
        hx,
        hy,
        cls.isMastered ? "#fbbf24" : "rgba(255,255,255,0.12)",
        cls.isMastered ? 3 : 1,
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
        // Abre seleção de Poder Heróico para classe já em 10/10
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

    const targetZoom = 1.65;
    const offsetLeft = -window.innerWidth * 0.22;
    this.zoom = targetZoom;
    this.pan = {
      x: offsetLeft - nx * targetZoom,
      y: -ny * targetZoom
    };

    const canvasEl = this.root.querySelector("#fu-tree-canvas");
    if (canvasEl) {
      canvasEl.classList.add("is-zoom-transition");
      canvasEl.style.transform = `translate(${this.pan.x}px, ${this.pan.y}px) scale(${this.zoom})`;
    }

    this.inspectedSkill = { cls, skill };
    setTimeout(() => {
      if (this.inspectedSkill) {
        this.renderTreeStage();
      }
    }, 220);
  }

  closeSkillShowcase() {
    this.inspectedSkill = null;
    if (this.savedCamera) {
      this.pan = { ...this.savedCamera.pan };
      this.zoom = this.savedCamera.zoom;
      this.savedCamera = null;
    }
    this.renderTreeStage();
    const canvasEl = this.root.querySelector("#fu-tree-canvas");
    if (canvasEl) {
      canvasEl.classList.add("is-zoom-transition");
      setTimeout(() => canvasEl.classList.remove("is-zoom-transition"), 350);
    }
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
        <div class="fu-skill-showcase-container">
          <!-- COLUNA ESQUERDA: MOLDURA DOURADA COM ÍCONE DA HABILIDADE E NOME EMBAIXO -->
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

          <!-- COLUNA DIREITA: FUNDO PRETO SEMI-TRANSPARENTE, DESCRIÇÃO E BOTÃO SELECIONAR -->
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
   * MODAL 3º PASSO: GRIMÓRIO DE FEITIÇOS (BANNER VERTICAL COM ELEMENTOS E STATUS)
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

    return pool.map((sp) => {
      const fuid = (sp.system?.fuid || "").trim().toLowerCase();
      const nameKey = sp.name.trim().toLowerCase();
      const alreadyKnown = (fuid && ownedKeys.has(fuid)) || ownedKeys.has(nameKey);
      const mpCost = sp.system?.cost?.amount || sp.system?.mpCost?.value || "0";
      const isOffensive = Boolean(sp.system?.isOffensive?.value || sp.system?.hasRoll?.value);
      const elements = detectSpellElements(sp);
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
        targetLabel,
        description: sp.system?.description || ""
      };
    });
  }

  buildSpellPickerHTML({ selection, showAllSpells }) {
    const spells = this.getSpellsForClass(selection.classFuid, showAllSpells);

    const bannersHtml = spells
      .map((sp) => {
        const primaryEl = sp.elements[0] || null;
        const elementsBadgesHtml = sp.elements
          .map(
            (el) => `
            <span class="fu-el-pill" style="color: ${el.color}; background: ${el.bg}; border-color: ${el.border};">
              ${el.icon} ${el.label}
            </span>
          `
          )
          .join("");

        return `
          <div class="fu-banner-spell-card ${sp.alreadyKnown ? "is-known" : ""}" data-search="${sp.name.toLowerCase()}">
            <!-- Fitas douradas nos cantos superiores -->
            <span class="fu-banner-ribbon left"></span>
            <span class="fu-banner-ribbon right"></span>

            <div class="fu-banner-card-frame">
              <h4 class="fu-banner-spell-title">${sp.name}</h4>
              <div class="fu-banner-subtitle">
                ${sp.isOffensive ? "Feitiço Ofensivo" : "Feitiço Arcano"} • ${selection.className}
              </div>

              <!-- Medalhão central com ícone do feitiço + pin elemental -->
              <div class="fu-banner-medallion" style="${primaryEl ? `border-color: ${primaryEl.color}; box-shadow: 0 0 22px ${primaryEl.bg};` : ""}">
                <img src="${sp.img}" alt="${sp.name}" />
                ${
                  primaryEl
                    ? `<span class="fu-medallion-element-badge" title="Dano de ${primaryEl.label}" style="border-color: ${primaryEl.color};">
                        ${primaryEl.icon}
                      </span>`
                    : ""
                }
              </div>

              <div class="fu-banner-rank-title">
                ${
                  elementsBadgesHtml ||
                  `<span class="fu-el-pill neutral">${sp.isOffensive ? "⚡ Ofensivo" : "✦ Suporte / Utilidade"}</span>`
                }
              </div>

              <div class="fu-banner-divider"></div>

              <!-- Linhas de atributos estilo pergaminho dourado -->
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
   * MODAL PODERES HERÓICOS (NÍVEL 10 NA CLASSE: EXCLUSIVOS OU GENÉRICOS)
   * ========================================================================== */
  getHeroicSkillsForClass(classFuid, className) {
    const ownedHeroics = this.actor.items.filter((i) => i.type === "heroic");
    const ownedKeys = new Set(
      ownedHeroics
        .flatMap((h) => [(h.system?.fuid || "").trim().toLowerCase(), h.name.trim().toLowerCase()])
        .filter(Boolean)
    );

    const exclusive = [];
    const generic = [];

    for (const hDoc of this.catalog.heroicSkills) {
      const fuid = (hDoc.system?.fuid || "").trim().toLowerCase();
      const nameKey = hDoc.name.trim().toLowerCase();
      const alreadyKnown = (fuid && ownedKeys.has(fuid)) || ownedKeys.has(nameKey);

      const hClass = (hDoc.system?.class?.value ?? hDoc.system?.class ?? "").toString().trim().toLowerCase();
      const requirement = (hDoc.system?.requirement?.value || "").trim();

      const mapped = {
        doc: hDoc,
        uuid: hDoc.uuid,
        name: hDoc.name,
        img: hDoc.img,
        alreadyKnown,
        requirement,
        description: hDoc.system?.description || ""
      };

      if (hClass && (hClass === classFuid || hClass === className.trim().toLowerCase())) {
        exclusive.push(mapped);
      } else if (!hClass || hClass === "none" || hClass === "generic") {
        generic.push(mapped);
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
      await new Promise((r) => setTimeout(r, 260));
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
      canvasEl.classList.add("is-zoom-transition");
      canvasEl.style.transform = `translate(0px, 0px) scale(1)`;
      setTimeout(() => canvasEl.classList.remove("is-zoom-transition"), 350);
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
        canvasEl.style.transform = `translate(${this.pan.x}px, ${this.pan.y}px) scale(${this.zoom})`;
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

    // Eventos do Modal de Escolher Nova Classe
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
            await new Promise((r) => setTimeout(r, 270));
          }

          this.stagedNewClass = classDoc;
          this.animateStagedSpawn = true;
          this.classPickerOpen = false;
          this.renderTreeStage();
        };
      });
    }

    // Eventos do Modal Grande de Inspeção de Habilidade (com Zoom)
    if (this.inspectedSkill) {
      const showcaseBackdrop = this.root.querySelector("#fu-skill-showcase-backdrop");
      showcaseBackdrop?.addEventListener("click", (ev) => {
        // Clicar fora dos painéis (no fundo escuro) volta para a Skill Tree
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
            currentRank: skill.currentRank,
            maxRank: skill.maxRank,
            willReachMastery,
            spellDoc: null,
            heroicDoc: null
          };

          // Se a perícia concede feitiço (ex.: Magia Elemental), abre o grimório de feitiços
          if (skill.grantsSpell) {
            this.inspectedSkill = null;
            this.spellPickerContext = { selection, showAllSpells: false };
            this.renderTreeStage();
            return;
          }

          // Se este ponto completa 10/10 na classe, abre a escolha de Poder Heróico
          if (willReachMastery) {
            this.inspectedSkill = null;
            this.heroicPickerContext = { selection, standaloneClass: null, activeTab: "exclusive" };
            this.renderTreeStage();
            return;
          }

          confirmBtn.disabled = true;
          await this.commitAdvancement(selection);
        };
      }
    }

    // Eventos do Modal de Seleção de Feitiços
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

          // Se este avanço também completou 10/10 na classe, segue para Poder Heróico
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

    // Eventos do Modal de Poderes Heróicos
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

  /**
   * Salva Poder Heróico avulso quando a classe já tinha atingido 10/10 anteriormente.
   */
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

  /**
   * Salva a classe (se nova), a habilidade, o feitiço (se houver) e o Poder Heróico (se atingiu 10/10).
   */
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

      this.inspectedSkill = null;
      this.spellPickerContext = null;
      this.heroicPickerContext = null;
      this.stagedNewClass = null;

      if (this.savedCamera) {
        this.pan = { ...this.savedCamera.pan };
        this.zoom = this.savedCamera.zoom;
        this.savedCamera = null;
      }

      refreshTopCenterTrigger(this.actor);

      const remaining = getPendingLevelInfo(this.actor).pending;
      if (remaining > 0) {
        this.renderTreeStage();
      } else {
        await this.closeWithAnimation(true);
      }
    } catch (err) {
      console.error("fu-level-up-wizard | Erro ao aplicar avanço de nível:", err);
      ui.notifications.error("Erro ao salvar o avanço de nível. Verifique o console (F12).");
    }
  }
}
