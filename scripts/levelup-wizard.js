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
    this.stage = "loading"; // "loading" | "reveal" | "tree"
    this.isClosing = false;

    this.catalog = {
      classes: [],
      skillsByUuid: new Map(),
      skillsByClassFuid: new Map()
    };

    // Estado da árvore radial (pan & zoom)
    this.pan = { x: 0, y: 0 };
    this.zoom = 1;
    this.isRightDragging = false;
    this.dragMoved = false;
    this.dragStart = { x: 0, y: 0 };

    // Nova classe colocada na árvore aguardando escolha de poder
    this.stagedNewClass = null;

    // Seleção atual antes de confirmar
    this.pendingSelection = null;
    this.activeHint = null;
    this.classPickerOpen = false;
  }

  async init() {
    // 1. Monta imediatamente o overlay com o Loading em Espiral para zero travamento visual
    this.mount();
    this.renderLoadingStage();

    // Aguarda 2 frames de renderização para garantir que a espiral já esteja animando na tela
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

    // 2. Carrega ou reutiliza o catálogo em cache
    await this.loadCompendiumData();

    // 3. Transiciona suavemente para a tela de Revelação de Nível
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
            <!-- Espiral logarítmica estilizada -->
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
          <p class="fu-loading-label">Carregando grimório de classes e poderes...</p>
        </div>
      </div>
    `;
  }

  /**
   * Carrega todas as Classes e Perícias (Poderes) dos compêndios do projectfu e homebrew (com cache).
   */
  async loadCompendiumData() {
    if (FULevelUpWizard._cachedCatalog) {
      this.catalog = FULevelUpWizard._cachedCatalog;
      return;
    }

    const classPacks = [];
    const skillPacks = [];

    for (const pack of game.packs) {
      if (pack.documentName !== "Item") continue;
      const id = pack.collection.toLowerCase();
      if (id.includes("class")) classPacks.push(pack);
      if (id.includes("skill") && !id.includes("heroic")) skillPacks.push(pack);
    }

    for (const pack of skillPacks) {
      const docs = await pack.getDocuments();
      for (const doc of docs) {
        if (doc.type !== "skill") continue;
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
      }
    }

    for (const item of game.items ?? []) {
      if (item.type !== "skill") continue;
      this.catalog.skillsByUuid.set(item.uuid, item);
      const classFuid = (item.system?.class?.value || "").trim().toLowerCase();
      if (classFuid) {
        if (!this.catalog.skillsByClassFuid.has(classFuid)) {
          this.catalog.skillsByClassFuid.set(classFuid, []);
        }
        const arr = this.catalog.skillsByClassFuid.get(classFuid);
        if (!arr.some((s) => (s.system?.fuid || s.name) === (item.system?.fuid || item.name))) {
          arr.push(item);
        }
      }
    }

    const seenFuids = new Set();
    for (const pack of classPacks) {
      const docs = await pack.getDocuments();
      for (const doc of docs) {
        if (doc.type !== "class") continue;
        const key = (doc.system?.fuid || doc.name).toLowerCase();
        if (seenFuids.has(key)) continue;
        seenFuids.add(key);
        this.catalog.classes.push(doc);
      }
    }

    for (const item of game.items ?? []) {
      if (item.type !== "class") continue;
      const key = (item.system?.fuid || item.name).toLowerCase();
      if (seenFuids.has(key)) continue;
      seenFuids.add(key);
      this.catalog.classes.push(item);
    }

    this.catalog.classes.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    FULevelUpWizard._cachedCatalog = this.catalog;
  }

  /**
   * Obtém todas as perícias pertencentes a uma classe.
   */
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

  /**
   * Retorna as classes atualmente na ficha + a classe nova recém-selecionada (se houver).
   */
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
          description: poolSkill.system?.description || ""
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

    // Se o jogador escolheu uma nova classe na modal, coloca ela imediatamente na árvore para escolher o poder
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
          description: poolSkill.system?.description || ""
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
        if (this.classPickerOpen) {
          this.classPickerOpen = false;
          this.renderTreeStage();
        } else if (this.activeHint) {
          this.activeHint = null;
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

  /**
   * Fecha a janela com animação suave (e opcionalmente um banner de conclusão).
   */
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
            <span class="fu-tree-drag-tip"><i class="fas fa-mouse"></i> Segure <strong>Botão Direito</strong> para arrastar • <strong>Clique Direito</strong> no poder para descrição</span>
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
          <div class="fu-tree-canvas" id="fu-tree-canvas" style="transform: translate(${this.pan.x}px, ${this.pan.y}px) scale(${this.zoom});">
            <svg class="fu-tree-lines-svg" id="fu-tree-lines-svg" width="2400" height="2400" viewBox="-1200 -1200 2400 2400"></svg>
            <div class="fu-tree-nodes-layer" id="fu-tree-nodes-layer"></div>
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

          ${
            this.pendingSelection
              ? `<div class="fu-confirm-bar">
                  <div class="fu-confirm-info">
                    <span class="fu-confirm-tag">${this.pendingSelection.isNewClass ? "NOVA CLASSE + PODER" : "EVOLUIR PODER"}</span>
                    <strong>${this.pendingSelection.className}</strong> — <span>${this.pendingSelection.skillName}</span>
                    <em>(NP ${this.pendingSelection.currentRank} ➔ ${this.pendingSelection.currentRank + 1})</em>
                  </div>
                  <div class="fu-confirm-actions">
                    <button type="button" class="fu-btn-cancel-pick">Cancelar</button>
                    <button type="button" class="fu-btn-commit-pick">
                      <i class="fas fa-check"></i> Confirmar Nível
                    </button>
                  </div>
                </div>`
              : ""
          }
        </footer>

        ${this.classPickerOpen ? this.buildClassPickerHTML(classesData) : ""}
      </div>
    `;

    this.populateRadialTree(classesData, info);
    this.bindTreeEvents();
  }

  populateRadialTree(classesData, info) {
    const svg = this.root.querySelector("#fu-tree-lines-svg");
    const layer = this.root.querySelector("#fu-tree-nodes-layer");
    if (!svg || !layer) return;

    // Anéis orbitais sutis no fundo do SVG para estética constelação
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

    // Núcleo Central com Retrato do Personagem
    const hub = document.createElement("div");
    hub.className = "fu-radial-center-hub";
    hub.innerHTML = `
      <div class="fu-hub-outer-ring"></div>
      <div class="fu-hub-portrait-box">
        <img src="${this.actor.img}" alt="${this.actor.name}" />
      </div>
    `;
    layer.appendChild(hub);

    // Estado sem classes: texto limpo, alinhado e sem caixas tortas
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

      const sectorDist = 135;
      const sx = Math.cos(baseAngle) * sectorDist;
      const sy = Math.sin(baseAngle) * sectorDist;

      this.appendSvgLine(svg, 0, 0, sx, sy, palette.primary, 3, true, cls.isStaged);

      const classNode = document.createElement("div");
      classNode.className = `fu-class-sector-node ${cls.isStaged ? "is-staged-class" : ""}`;
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

        const isSelected =
          this.pendingSelection &&
          this.pendingSelection.classFuid === cls.fuid &&
          this.pendingSelection.skillName === skill.name;

        this.appendSvgLine(
          svg,
          sx,
          sy,
          nx,
          ny,
          isUnlocked || isSelected ? palette.primary : "rgba(148, 163, 184, 0.28)",
          isUnlocked || isSelected ? 2.5 : 1.5,
          isUnlocked || isSelected
        );

        let dotsHtml = `<div class="fu-skill-dots">`;
        for (let d = 1; d <= skill.maxRank; d++) {
          const filledDot = d <= skill.currentRank;
          const previewDot = isSelected && d === skill.currentRank + 1;
          dotsHtml += `<span class="fu-dot ${filledDot ? "is-filled" : ""} ${previewDot ? "is-preview" : ""}"></span>`;
        }
        dotsHtml += `</div>`;

        const skillEl = document.createElement("div");
        skillEl.className = [
          "fu-skill-node",
          isUnlocked ? "is-unlocked" : "is-locked",
          isMaxed ? "is-maxed" : "",
          canInvest ? "is-investable" : "",
          isSelected ? "is-selected" : ""
        ]
          .filter(Boolean)
          .join(" ");

        skillEl.style.left = `${nx}px`;
        skillEl.style.top = `${ny}px`;
        if (isUnlocked || isSelected) {
          skillEl.style.setProperty("--node-accent", palette.primary);
          skillEl.style.setProperty("--node-glow", palette.glow);
        }

        skillEl.innerHTML = `
          <div class="fu-skill-circle">
            <img src="${skill.img}" alt="${skill.name}" />
          </div>
          ${dotsHtml}
          <span class="fu-skill-ratio">${skill.currentRank}/${skill.maxRank}</span>
          <span class="fu-skill-title">${skill.name}</span>
        `;

        skillEl.addEventListener("click", (ev) => {
          ev.stopPropagation();
          if (!canInvest) {
            if (isMaxed) {
              ui.notifications.warn(`"${skill.name}" já está no nível máximo (${skill.maxRank}/${skill.maxRank}).`);
            } else if (isClassCapped) {
              ui.notifications.warn(`A classe ${cls.name} já atingiu o limite de 10 níveis.`);
            }
            return;
          }

          this.pendingSelection = {
            isNewClass: cls.isStaged,
            actorClassItem: cls.actorItem,
            classDoc: cls.compendiumDoc,
            className: cls.name,
            classFuid: cls.fuid,
            skillDoc: skill.poolDoc,
            actorSkillItem: skill.actorItem,
            skillName: skill.name,
            currentRank: skill.currentRank,
            maxRank: skill.maxRank
          };
          this.renderTreeStage();
        });

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
        !cls.isMastered
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

  appendSvgLine(svg, x1, y1, x2, y2, stroke, width = 2, glowing = false, dashed = false) {
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
    svg.appendChild(line);
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

  /**
   * Modal enxuta de Escolha de Nova Classe:
   * Exibe SOMENTE o card com ícone, nome da classe e o botão "Escolher essa Classe".
   */
  buildClassPickerHTML(ownedClassesData) {
    const ownedFuids = new Set(ownedClassesData.map((c) => c.fuid));
    const available = this.catalog.classes.filter((c) => {
      const fuid = (c.system?.fuid || c.name).trim().toLowerCase();
      return !ownedFuids.has(fuid);
    });

    const cardsHtml = available
      .map((cls) => {
        const fuid = (cls.system?.fuid || cls.name).trim().toLowerCase();
        return `
          <div class="fu-picker-simple-card" data-search="${cls.name.toLowerCase()}">
            <div class="fu-picker-simple-icon">
              <img src="${cls.img}" alt="${cls.name}" />
            </div>
            <h4 class="fu-picker-simple-name">${cls.name}</h4>
            <button type="button" class="fu-choose-class-card-btn" data-class-fuid="${fuid}">
              Escolher essa Classe
            </button>
          </div>
        `;
      })
      .join("");

    return `
      <div class="fu-class-picker-modal">
        <div class="fu-class-picker-box">
          <div class="fu-picker-header">
            <div>
              <h3>Escolher Nova Classe (${ownedClassesData.length + 1} de ${MAX_CLASSES})</h3>
              <p>Escolha uma classe para adicioná-la à árvore radial e selecionar seu poder:</p>
            </div>
            <input type="search" id="fu-class-search-input" placeholder="Buscar classe..." />
            <button type="button" class="fu-picker-close-btn" title="Fechar"><i class="fas fa-times"></i></button>
          </div>
          <div class="fu-picker-simple-grid" id="fu-picker-grid">
            ${cardsHtml || "<p>Nenhuma classe adicional encontrada nos compêndios.</p>"}
          </div>
        </div>
      </div>
    `;
  }

  bindTreeEvents() {
    const viewport = this.root.querySelector("#fu-tree-viewport");
    const canvasEl = this.root.querySelector("#fu-tree-canvas");

    this.root.querySelector(".fu-tree-back-btn").onclick = () => this.renderRevealStage();

    this.root.querySelector(".fu-tree-reset-cam").onclick = () => {
      this.pan = { x: 0, y: 0 };
      this.zoom = 1;
      canvasEl.style.transform = `translate(0px, 0px) scale(1)`;
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
        ev.preventDefault();
        const delta = ev.deltaY > 0 ? -0.08 : 0.08;
        this.zoom = Math.min(1.5, Math.max(0.5, Number((this.zoom + delta).toFixed(2))));
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
        if (this.pendingSelection?.isNewClass) {
          this.pendingSelection = null;
        }
        this.classPickerOpen = true;
        this.renderTreeStage();
      };
    }

    if (this.classPickerOpen) {
      this.root.querySelector(".fu-picker-close-btn").onclick = () => {
        this.classPickerOpen = false;
        this.renderTreeStage();
      };

      const searchInput = this.root.querySelector("#fu-class-search-input");
      searchInput?.addEventListener("input", (ev) => {
        const q = ev.target.value.trim().toLowerCase();
        this.root.querySelectorAll(".fu-picker-simple-card").forEach((card) => {
          const match = card.dataset.search.includes(q);
          card.style.display = match ? "" : "none";
        });
      });

      this.root.querySelectorAll(".fu-choose-class-card-btn").forEach((btn) => {
        btn.onclick = () => {
          const classFuid = btn.dataset.classFuid;
          const classDoc = this.catalog.classes.find(
            (c) => (c.system?.fuid || c.name).trim().toLowerCase() === classFuid
          );
          if (!classDoc) return;

          // Coloca imediatamente a classe escolhida na árvore radial para selecionar o poder
          this.stagedNewClass = classDoc;
          this.pendingSelection = null;
          this.classPickerOpen = false;
          this.renderTreeStage();
        };
      });
    }

    const cancelBtn = this.root.querySelector(".fu-btn-cancel-pick");
    if (cancelBtn) {
      cancelBtn.onclick = () => {
        this.pendingSelection = null;
        this.renderTreeStage();
      };
    }

    const commitBtn = this.root.querySelector(".fu-btn-commit-pick");
    if (commitBtn && this.pendingSelection) {
      commitBtn.onclick = async () => {
        commitBtn.disabled = true;
        await this.commitAdvancement(this.pendingSelection);
      };
    }
  }

  /**
   * Salva a classe (se nova) e a habilidade na ficha do personagem no formato nativo do projectfu.
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
        entries: {}
      };

      const emptyIndex = advancements.findIndex((adv) => !adv?.skill?.id);
      if (emptyIndex >= 0) {
        advancements[emptyIndex] = newEntry;
      } else {
        advancements.push(newEntry);
      }

      await this.actor.update({ "system.advancements": advancements });

      ui.notifications.info(
        `${this.actor.name}: ${selection.className} — ${selection.skillName} (NP ${newSkillRank}/${maxSkillRank}) aplicado!`
      );

      this.pendingSelection = null;
      this.stagedNewClass = null;
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
