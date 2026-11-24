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
 * Limpa tags @ICON[...] e @UUID[...] de descrições do projectfu para leitura limpa.
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
        martial: "🛡 Marcial"
      };
      return `<span class="fu-inline-tag">${map[iconName.toLowerCase()] || iconName}</span>`;
    })
    .replace(/@UUID\[([^\]]+)\](?:\{([^}]+)\})?/g, (_, _uuid, label) => {
      return `<strong>${label || "Referência"}</strong>`;
    });
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
  return desc.includes("aprende um feitiço") || desc.includes("learn a") && desc.includes("spell");
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
      spells: []
    };

    // Estado da câmera da árvore radial (pan & zoom)
    this.pan = { x: 0, y: 0 };
    this.zoom = 1;
    this.savedCamera = null;
    this.isRightDragging = false;
    this.dragMoved = false;
    this.dragStart = { x: 0, y: 0 };

    // Estados de seleção
    this.stagedNewClass = null;
    this.animateStagedSpawn = false;
    this.inspectedSkill = null; // { cls, skill } -> abre o modal grande com zoom
    this.spellPickerContext = null; // { selection, showAllSpells } -> abre o grimório de feitiços
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

  /**
   * Tela de carregamento em espiral exibida instantaneamente enquanto os compêndios são indexados.
   */
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
          <p class="fu-loading-label">Carregando grimório de classes, poderes e feitiços...</p>
        </div>
      </div>
    `;
  }

  /**
   * Carrega Classes, Perícias e Feitiços apenas dos compêndios relevantes (otimizado via index).
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
        pack.index.some((entry) => entry.type === "class" || entry.type === "skill" || entry.type === "spell");

      if (hasRelevantType && !col.includes("heroic")) {
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
      }
    }

    this.catalog.classes.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    this.catalog.spells.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
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
        isMastered: investedPoints >= MAX_SKILLS_PER_CLASS
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
          isMastered: false
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
        if (this.spellPickerContext) {
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
    window.addEventListener("keydown", this._onKeyDown);
  }

  destroyImmediate() {
    window.removeEventListener("keydown", this._onKeyDown);
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
            <span class="fu-tree-drag-tip"><i class="fas fa-mouse"></i> <strong>Clique Esquerdo</strong> para inspecionar e selecionar • <strong>Botão Direito</strong> arrasta a tela</span>
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
      </div>
    `;

    this.populateRadialTree(classesData, info);
    this.bindTreeEvents();

    // Consome a flag de animação de spawn após montar a árvore
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

        // Efeito "Tela Viva": inclina/puxa suavemente a câmera na direção do nó ao passar o cursor
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

        // Clique Esquerdo: dá zoom na habilidade e abre o Modal/Painel Grande de Detalhes + Selecionar
        skillEl.addEventListener("click", (ev) => {
          ev.stopPropagation();
          if (this.dragMoved) return;
          this.openSkillShowcase(cls, skill, nx, ny);
        });

        // Clique Direito: hint rápido flutuante
        skillEl.addEventListener("contextmenu", (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          if (this.dragMoved) return;
          this.showSkillHint(skill, cls, ev.clientX, ev.clientY);
        });

        layer.appendChild(skillEl);
      });

      // Botão Poder Heróico ao atingir 10 habilidades na classe
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
      heroicBtn.className = `fu-heroic-node-btn ${cls.isMastered ? "is-ready" : "is-locked"}`;
      heroicBtn.style.left = `${hx}px`;
      heroicBtn.style.top = `${hy}px`;
      heroicBtn.innerHTML = `
        <i class="fas fa-crown"></i>
        <span>Poder Heróico</span>
        <small>${cls.isMastered ? "Desbloqueado!" : `${cls.investedPoints}/10`}</small>
      `;
      heroicBtn.onclick = (ev) => {
        ev.stopPropagation();
        if (!cls.isMastered) {
          ui.notifications.info(
            `Atinja 10 níveis de habilidade em ${cls.name} (${cls.investedPoints}/10) para liberar o Poder Heróico.`
          );
          return;
        }
        ui.notifications.info(
          `Poder Heróico de ${cls.name} desbloqueado! Configuraremos a seleção de Poderes Heróicos na próxima etapa.`
        );
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

    // Aproxima o zoom na habilidade clicada e posiciona ela alinhada à esquerda
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
    }, 240);
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
    const canInvest = info.pending > 0 && !isMaxed && !isClassCapped;
    const npPct = Math.round((skill.currentRank / skill.maxRank) * 100);

    let ctaLabel = "SELECIONAR";
    if (skill.grantsSpell && canInvest) {
      ctaLabel = "SELECIONAR & ESCOLHER FEITIÇO";
    } else if (isMaxed) {
      ctaLabel = "NÍVEL MÁXIMO ATINGIDO";
    } else if (isClassCapped) {
      ctaLabel = "CLASSE COMPLETA (10/10)";
    } else if (info.pending <= 0) {
      ctaLabel = "SEM PONTOS PENDENTES";
    }

    return `
      <div class="fu-skill-showcase-backdrop">
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
              skill.grantsSpell
                ? `<div class="fu-showcase-spell-notice">
                    <i class="fas fa-hat-wizard"></i>
                    <span>Ao selecionar este poder, você escolherá <strong>1 Feitiço</strong> da lista de ${cls.name}.</span>
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
                <span class="fu-select-corner tl"></span>
                <span class="fu-select-corner br"></span>
                <span>${ctaLabel}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  /* ==========================================================================
   * MODAL 3º PASSO: GRIMÓRIO DE FEITIÇOS (PARA PERÍCIAS QUE CONCEDEM FEITIÇOS)
   * ========================================================================== */
  getSpellsForClass(classFuid, showAll = false) {
    const ownedSpells = this.actor.items.filter((i) => i.type === "spell");
    const ownedKeys = new Set(
      ownedSpells.flatMap((s) => [
        (s.system?.fuid || "").trim().toLowerCase(),
        s.name.trim().toLowerCase()
      ]).filter(Boolean)
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

      return {
        doc: sp,
        uuid: sp.uuid,
        name: sp.name,
        img: sp.img,
        alreadyKnown,
        mpCost: sp.system?.cost?.amount || sp.system?.mpCost?.value || "",
        target: sp.system?.targeting?.rule || "",
        duration: sp.system?.duration?.value || "",
        isOffensive: Boolean(sp.system?.isOffensive?.value || sp.system?.hasRoll?.value),
        description: sp.system?.description || ""
      };
    });
  }

  buildSpellPickerHTML({ selection, showAllSpells }) {
    const spells = this.getSpellsForClass(selection.classFuid, showAllSpells);

    const cardsHtml = spells
      .map(
        (sp) => `
        <div class="fu-spell-card ${sp.alreadyKnown ? "is-known" : ""}" data-search="${sp.name.toLowerCase()}">
          <div class="fu-spell-card-header">
            <img src="${sp.img}" alt="${sp.name}" />
            <div class="fu-spell-card-meta">
              <h4>${sp.name}</h4>
              <div class="fu-spell-tags">
                ${sp.isOffensive ? `<span class="fu-spell-tag off">⚡ Ofensivo</span>` : ""}
                ${sp.mpCost ? `<span class="fu-spell-tag mp">${sp.mpCost} PM</span>` : ""}
              </div>
            </div>
            ${sp.alreadyKnown ? `<span class="fu-spell-known-badge">Já Aprendido</span>` : ""}
          </div>

          <div class="fu-spell-card-desc">
            ${formatFUDescription(sp.description)}
          </div>

          <button
            type="button"
            class="fu-choose-spell-btn"
            data-spell-uuid="${sp.uuid}"
            ${sp.alreadyKnown ? "disabled" : ""}
          >
            ${sp.alreadyKnown ? "Feitiço já aprendido" : "Aprender Feitiço & Confirmar"}
          </button>
        </div>
      `
      )
      .join("");

    return `
      <div class="fu-class-picker-modal" id="fu-spell-picker-modal">
        <div class="fu-class-picker-box">
          <div class="fu-picker-header">
            <div>
              <h3>Escolher Feitiço — ${selection.className}</h3>
              <p>Poder selecionado: <strong>${selection.skillName}</strong>. Escolha o feitiço que deseja aprender:</p>
            </div>
            <button type="button" class="fu-spell-toggle-all-btn" id="fu-spell-toggle-all">
              ${showAllSpells ? "Filtrar pela Classe" : "Mostrar Todos os Feitiços"}
            </button>
            <input type="search" id="fu-spell-search-input" placeholder="Buscar feitiço..." />
            <button type="button" class="fu-picker-close-btn" id="fu-spell-picker-close" title="Voltar"><i class="fas fa-times"></i></button>
          </div>
          <div class="fu-spell-grid">
            ${cardsHtml || "<p>Nenhum feitiço encontrado nos compêndios.</p>"}
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
              <!-- Emblema em losango dourado no topo com o ícone da classe -->
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
        this.dragMoved = false;
        this.dragStart = { x: ev.clientX - this.pan.x, y: ev.clientY - this.pan.y };
        viewport.classList.add("is-grabbing");
      } else if (ev.button === 0) {
        this.removeHintElement();
      }
    });

    window.addEventListener("mousemove", (ev) => {
      if (!this.isRightDragging) return;
      const nextX = ev.clientX - this.dragStart.x;
      const nextY = ev.clientY - this.dragStart.y;
      if (Math.abs(nextX - this.pan.x) > 4 || Math.abs(nextY - this.pan.y) > 4) {
        this.dragMoved = true;
      }
      this.pan.x = nextX;
      this.pan.y = nextY;
      if (canvasEl) {
        canvasEl.style.transform = `translate(${this.pan.x}px, ${this.pan.y}px) scale(${this.zoom})`;
      }
    });

    window.addEventListener("mouseup", (ev) => {
      if (ev.button === 2 && this.isRightDragging) {
        this.isRightDragging = false;
        viewport?.classList.remove("is-grabbing");
      }
    });

    viewport.addEventListener(
      "wheel",
      (ev) => {
        if (this.inspectedSkill || this.classPickerOpen || this.spellPickerContext) return;
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

          // Anima o fechamento do modal e dispara a animação das habilidades saindo da classe
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
      this.root.querySelector("#fu-showcase-cancel-btn")?.addEventListener("click", () => {
        this.closeSkillShowcase();
      });

      const confirmBtn = this.root.querySelector("#fu-showcase-confirm-btn");
      if (confirmBtn && !confirmBtn.disabled) {
        confirmBtn.onclick = async () => {
          const { cls, skill } = this.inspectedSkill;
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
            spellDoc: null
          };

          // Se a perícia concede feitiço (ex.: Magia Elemental), abre o grimório de feitiços
          if (skill.grantsSpell) {
            this.inspectedSkill = null;
            this.spellPickerContext = { selection, showAllSpells: false };
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
        this.root.querySelectorAll(".fu-spell-card").forEach((card) => {
          card.style.display = card.dataset.search.includes(q) ? "" : "none";
        });
      });

      this.root.querySelectorAll(".fu-choose-spell-btn").forEach((btn) => {
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
          await this.commitAdvancement(selection);
        };
      });
    }
  }

  /**
   * Salva a classe (se nova), a habilidade e o feitiço (se houver) na estrutura nativa do projectfu.
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
        entries: embeddedSpellId
          ? {
              spell: {
                id: embeddedSpellId,
                locked: false
              }
            }
          : {}
      };

      const emptyIndex = advancements.findIndex((adv) => !adv?.skill?.id);
      if (emptyIndex >= 0) {
        advancements[emptyIndex] = newEntry;
      } else {
        advancements.push(newEntry);
      }

      await this.actor.update({ "system.advancements": advancements });

      const spellSuffix = selection.spellDoc ? ` + Feitiço: ${selection.spellDoc.name}` : "";
      ui.notifications.info(
        `${this.actor.name}: ${selection.className} — ${selection.skillName} (NP ${newSkillRank}/${maxSkillRank})${spellSuffix} aplicado!`
      );

      this.inspectedSkill = null;
      this.spellPickerContext = null;
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
