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
 * Limpa tags @ICON[...] e formata HTML de descrições do projectfu para leitura limpa.
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
 * Gera resumo legível dos Benefícios Gratuitos da classe.
 */
function getClassBenefitsList(classSystem) {
  const list = [];
  const res = classSystem?.benefits?.resources ?? {};
  const mar = classSystem?.benefits?.martials ?? {};
  const rit = classSystem?.benefits?.rituals ?? {};

  if (res.hp?.value) list.push("+5 Pontos de Vida (PV) máximos");
  if (res.mp?.value) list.push("+5 Pontos de Mente (PM) máximos");
  if (res.ip?.value) list.push("+2 Pontos de Inventário (PI) máximos");

  const martials = [];
  if (mar.melee?.value) martials.push("Armas Marciais Corpo a Corpo");
  if (mar.ranged?.value) martials.push("Armas Marciais à Distância");
  if (mar.armor?.value) martials.push("Armaduras Marciais");
  if (mar.shields?.value) martials.push("Escudos Marciais");
  if (martials.length) list.push(`Equipar: ${martials.join(", ")}`);

  const rituals = [];
  if (rit.arcanism?.value) rituals.push("Arcanismo");
  if (rit.chimerism?.value) rituals.push("Quimerismo");
  if (rit.elementalism?.value) rituals.push("Elementalismo");
  if (rit.entropism?.value) rituals.push("Entropismo");
  if (rit.ritualism?.value) rituals.push("Ritualismo");
  if (rit.spiritism?.value) rituals.push("Espiritismo");
  if (rituals.length) list.push(`Rituais: ${rituals.join(", ")}`);

  return list.length ? list : ["Nenhum benefício passivo adicional."];
}

export class FULevelUpWizard {
  static activeInstance = null;

  static async open(actor) {
    if (!actor) return;
    if (this.activeInstance) {
      this.activeInstance.close();
    }
    const instance = new FULevelUpWizard(actor);
    this.activeInstance = instance;
    await instance.init();
  }

  constructor(actor) {
    this.actor = actor;
    this.root = null;
    this.stage = "reveal"; // "reveal" | "tree"
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

    // Seleção atual antes de confirmar
    this.pendingSelection = null; // { classItemOrCompendium, skillDoc, isNewClass }
    this.activeHint = null;
    this.classPickerOpen = false;
  }

  async init() {
    await this.loadCompendiumData();
    this.mount();
    this.renderRevealStage();
  }

  /**
   * Carrega todas as Classes e Perícias (Poderes) dos compêndios do projectfu e homebrew.
   */
  async loadCompendiumData() {
    const classPacks = [];
    const skillPacks = [];

    for (const pack of game.packs) {
      if (pack.documentName !== "Item") continue;
      const id = pack.collection.toLowerCase();
      if (id.includes("class")) classPacks.push(pack);
      if (id.includes("skill") && !id.includes("heroic")) skillPacks.push(pack);
    }

    // Carrega todas as skills primeiro para indexar por UUID e por class.value (fuid)
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

    // Também inclui skills criadas diretamente no mundo (game.items)
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

    // Carrega todas as classes
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
  }

  /**
   * Obtém todas as perícias pertencentes a uma classe (via @UUID na descrição + fuid).
   */
  getSkillsForClass(classDoc) {
    const result = [];
    const seen = new Set();

    // 1. Extrai links @UUID[...]{...} da descrição da classe na ordem exata do livro
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

    // 2. Complementa com skills indexadas pelo fuid da classe
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
   * Retorna as classes atualmente presentes na ficha do personagem + contagem de níveis de poder nela.
   */
  getActorClassesData() {
    const ownedClasses = this.actor.items.filter((i) => i.type === "class");
    const ownedSkills = this.actor.items.filter((i) => i.type === "skill");

    return ownedClasses.map((clsItem, idx) => {
      const fuid = (clsItem.system?.fuid || "").trim().toLowerCase();
      const classSkillPool = this.getSkillsForClass(clsItem);

      // Mapeia cada skill da classe com seu nível atual na ficha
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
          cost: poolSkill.system?.cost || {}
        };
      });

      const investedPoints = skills.reduce((sum, s) => sum + s.currentRank, 0);

      return {
        actorItem: clsItem,
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
  }

  mount() {
    this.root = document.createElement("div");
    this.root.id = "fu-levelup-overlay";
    document.body.appendChild(this.root);

    // Atalho ESC para fechar
    this._onKeyDown = (ev) => {
      if (ev.key === "Escape") {
        if (this.classPickerOpen) {
          this.classPickerOpen = false;
          this.renderTreeStage();
        } else if (this.activeHint) {
          this.activeHint = null;
          this.removeHintElement();
        } else {
          this.close();
        }
      }
    };
    window.addEventListener("keydown", this._onKeyDown);
  }

  close() {
    window.removeEventListener("keydown", this._onKeyDown);
    if (this.root) {
      this.root.remove();
      this.root = null;
    }
    if (FULevelUpWizard.activeInstance === this) {
      FULevelUpWizard.activeInstance = null;
    }
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

    // Em Fabula Ultima, cada nível de personagem aumenta +1 PV máx e +1 PM máx automaticamente
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
          <!-- COLUNA ESQUERDA: RETRATO DO PERSONAGEM -->
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

          <!-- COLUNA DIREITA: TÍTULO, GANHOS DE PV/PM E BOTÃO -->
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

            <!-- CAMPOS DE AUMENTO DE VIDA E MANA -->
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

            <!-- BARRA DE PROGRESSO DO NÍVEL -->
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

            <!-- BOTÃO PRINCIPAL INFERIOR -->
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

    this.root.querySelector(".fu-overlay-close-btn").onclick = () => this.close();
    this.root.querySelector(".fu-btn-open-tree").onclick = () => {
      this.pan = { x: 0, y: 0 };
      this.zoom = 1;
      this.renderTreeStage();
    };
  }

  /* ==========================================================================
   * ETAPA 2: ÁRVORE RADIAL DE CLASSES E HABILIDADES (FUNDO PRETO + DRAG DIREITO)
   * ========================================================================== */
  renderTreeStage() {
    this.stage = "tree";
    const info = getPendingLevelInfo(this.actor);
    const classesData = this.getActorClassesData();
    const canAddClass = classesData.length < MAX_CLASSES;

    this.root.innerHTML = `
      <div class="fu-tree-screen">
        <!-- BARRA SUPERIOR -->
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

        <!-- VIEWPORT PANORÂMICO -->
        <div class="fu-tree-viewport" id="fu-tree-viewport">
          <div class="fu-tree-canvas" id="fu-tree-canvas" style="transform: translate(${this.pan.x}px, ${this.pan.y}px) scale(${this.zoom});">
            <svg class="fu-tree-lines-svg" id="fu-tree-lines-svg" width="2400" height="2400" viewBox="-1200 -1200 2400 2400"></svg>
            <div class="fu-tree-nodes-layer" id="fu-tree-nodes-layer"></div>
          </div>
        </div>

        <!-- BARRA INFERIOR: ESCOLHER NOVA CLASSE + CONFIRMAÇÃO DE PONTO -->
        <footer class="fu-tree-bottombar">
          ${
            canAddClass
              ? `<button type="button" class="fu-new-class-btn ${classesData.length === 0 ? "fu-pulse-cta" : ""}">
                  <i class="fas fa-plus-circle"></i> Escolher Nova Classe (${classesData.length}/${MAX_CLASSES})
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
    this.bindTreeEvents(classesData);
  }

  /**
   * Constrói o núcleo central (retrato + setores de classe), ramificações SVG, nós de habilidades,
   * bolinhas de progresso e o botão de Poder Heróico ao completar 10 habilidades na classe.
   */
  populateRadialTree(classesData, info) {
    const svg = this.root.querySelector("#fu-tree-lines-svg");
    const layer = this.root.querySelector("#fu-tree-nodes-layer");
    if (!svg || !layer) return;

    // 1. Núcleo Central com Retrato do Personagem
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
      const emptyPrompt = document.createElement("div");
      emptyPrompt.className = "fu-empty-tree-prompt";
      emptyPrompt.innerHTML = `
        <p>Este personagem ainda não possui nenhuma classe.</p>
        <button type="button" class="fu-empty-pick-class-btn">
          <i class="fas fa-hat-wizard"></i> Escolher Primeira Classe
        </button>
      `;
      emptyPrompt.querySelector("button").onclick = () => {
        this.classPickerOpen = true;
        this.renderTreeStage();
      };
      layer.appendChild(emptyPrompt);
      return;
    }

    // Distribui os ângulos das classes ao redor do círculo (começando pelo topo: -90°)
    const count = classesData.length;
    const angleStep = (Math.PI * 2) / count;
    const startAngle = -Math.PI / 2;

    classesData.forEach((cls, cIdx) => {
      const baseAngle = startAngle + cIdx * angleStep;
      const palette = cls.palette;

      // Distância do setor da classe em relação ao retrato central
      const sectorDist = 135;
      const sx = Math.cos(baseAngle) * sectorDist;
      const sy = Math.sin(baseAngle) * sectorDist;

      // Linha do centro até o setor da classe
      this.appendSvgLine(svg, 0, 0, sx, sy, palette.primary, 3, true);

      // Nó/Setor da Classe (onde ficava "Type Name")
      const classNode = document.createElement("div");
      classNode.className = "fu-class-sector-node";
      classNode.style.left = `${sx}px`;
      classNode.style.top = `${sy}px`;
      classNode.style.borderColor = palette.primary;
      classNode.style.boxShadow = `0 0 22px ${palette.glow}, inset 0 0 14px ${palette.bg}`;
      classNode.innerHTML = `
        <img src="${cls.img}" alt="${cls.name}" />
        <span class="fu-class-sector-name">${cls.name}</span>
        <span class="fu-class-sector-lvl">${cls.investedPoints}/${MAX_SKILLS_PER_CLASS}</span>
      `;
      layer.appendChild(classNode);

      // Distribui as habilidades desta classe em leque/árvore radial
      const skills = cls.skills;
      const maxSpread = count === 1 ? Math.PI * 1.4 : Math.min(Math.PI * 0.72, angleStep * 0.82);

      skills.forEach((skill, sIdx) => {
        const ratio = skills.length === 1 ? 0 : sIdx / (skills.length - 1) - 0.5;
        const skillAngle = baseAngle + ratio * maxSpread;

        // Alterna dois raios para evitar sobreposição entre nós vizinhos
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

        // Linha conectando o setor da classe à habilidade
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

        // Gera bolinhas cinzas/verdes abaixo do ícone
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

        // Clique Esquerdo: seleciona a habilidade para investir 1 ponto
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
            isNewClass: false,
            actorClassItem: cls.actorItem,
            classDoc: cls.actorItem,
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

        // Clique Direito (sem arrastar): exibe o Hint com a descrição da habilidade
        skillEl.addEventListener("contextmenu", (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          if (this.dragMoved) return;
          this.showSkillHint(skill, cls, ev.clientX, ev.clientY);
        });

        layer.appendChild(skillEl);
      });

      // BOTÃO DE PODER HERÓICO NO FINAL DA ÁRVORE DA CLASSE (ao atingir 10 habilidades)
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

  /**
   * Exibe um hint flutuante com a descrição completa da habilidade ao clicar com o botão direito.
   */
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

    // Posiciona dentro dos limites da tela
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
   * Modal para escolher uma nova classe (até o máximo de 5 classes).
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
        const benefits = getClassBenefitsList(cls.system);
        const skills = this.getSkillsForClass(cls);

        return `
          <div class="fu-picker-card" data-class-fuid="${fuid}" data-search="${cls.name.toLowerCase()}">
            <div class="fu-picker-card-top">
              <img src="${cls.img}" alt="${cls.name}" />
              <div>
                <h4>${cls.name}</h4>
                <span class="fu-picker-source">${cls.system?.source || "Fabula Ultima"}</span>
              </div>
            </div>
            <ul class="fu-picker-benefits">
              ${benefits.map((b) => `<li>✦ ${b}</li>`).join("")}
            </ul>
            <div class="fu-picker-skills-preview">
              <strong>Poderes (${skills.length}):</strong>
              <div class="fu-picker-skill-chips">
                ${skills
                  .map(
                    (s) => `
                    <button type="button" class="fu-picker-skill-btn" data-class-fuid="${fuid}" data-skill-uuid="${s.uuid}">
                      <img src="${s.img}" alt="${s.name}" />
                      <span>${s.name} (NP ${s.system?.level?.max ?? 1})</span>
                    </button>
                  `
                  )
                  .join("")}
              </div>
            </div>
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
              <p>Selecione a nova classe e o primeiro Poder que deseja adquirir neste nível:</p>
            </div>
            <input type="search" id="fu-class-search-input" placeholder="Buscar classe..." />
            <button type="button" class="fu-picker-close-btn"><i class="fas fa-times"></i></button>
          </div>
          <div class="fu-picker-grid" id="fu-picker-grid">
            ${cardsHtml || "<p>Nenhuma classe adicional encontrada nos compêndios.</p>"}
          </div>
        </div>
      </div>
    `;
  }

  bindTreeEvents(classesData) {
    const viewport = this.root.querySelector("#fu-tree-viewport");
    const canvasEl = this.root.querySelector("#fu-tree-canvas");

    this.root.querySelector(".fu-tree-back-btn").onclick = () => this.renderRevealStage();

    this.root.querySelector(".fu-tree-reset-cam").onclick = () => {
      this.pan = { x: 0, y: 0 };
      this.zoom = 1;
      canvasEl.style.transform = `translate(0px, 0px) scale(1)`;
    };

    // Arraste com o BOTÃO DIREITO do mouse
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

    // Zoom suave na roda do mouse
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

    // Botão Escolher Nova Classe
    const newClassBtn = this.root.querySelector(".fu-new-class-btn");
    if (newClassBtn) {
      newClassBtn.onclick = () => {
        this.classPickerOpen = true;
        this.renderTreeStage();
      };
    }

    // Eventos do Modal de Nova Classe
    if (this.classPickerOpen) {
      this.root.querySelector(".fu-picker-close-btn").onclick = () => {
        this.classPickerOpen = false;
        this.renderTreeStage();
      };

      const searchInput = this.root.querySelector("#fu-class-search-input");
      searchInput?.addEventListener("input", (ev) => {
        const q = ev.target.value.trim().toLowerCase();
        this.root.querySelectorAll(".fu-picker-card").forEach((card) => {
          const match = card.dataset.search.includes(q);
          card.style.display = match ? "" : "none";
        });
      });

      this.root.querySelectorAll(".fu-picker-skill-btn").forEach((btn) => {
        btn.onclick = () => {
          const classFuid = btn.dataset.classFuid;
          const skillUuid = btn.dataset.skillUuid;
          const classDoc = this.catalog.classes.find(
            (c) => (c.system?.fuid || c.name).trim().toLowerCase() === classFuid
          );
          const skillDoc = this.catalog.skillsByUuid.get(skillUuid);
          if (!classDoc || !skillDoc) return;

          this.pendingSelection = {
            isNewClass: true,
            actorClassItem: null,
            classDoc,
            className: classDoc.name,
            classFuid,
            skillDoc,
            actorSkillItem: null,
            skillName: skillDoc.name,
            currentRank: 0,
            maxRank: Math.max(1, Number(skillDoc.system?.level?.max ?? 1))
          };
          this.classPickerOpen = false;
          this.renderTreeStage();
        };
      });
    }

    // Confirmação / Cancelamento da escolha do nível
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
   * Aplica a escolha na ficha do personagem exatamente na estrutura nativa do projectfu:
   * - Cria o item de Classe (se nova classe)
   * - Cria ou incrementa o nível (system.level.value) do item de Perícia (Poder)
   * - Atualiza actor.system.advancements com os IDs embutidos corretos
   */
  async commitAdvancement(selection) {
    try {
      let embeddedClassId = selection.actorClassItem?.id ?? null;
      let isNewClassEntry = false;

      // 1. Se for uma classe nova, cria o item de Classe na ficha do ator
      if (selection.isNewClass) {
        const classData = selection.classDoc.toObject();
        delete classData._id;
        const [createdClass] = await this.actor.createEmbeddedDocuments("Item", [classData]);
        embeddedClassId = createdClass.id;
        isNewClassEntry = true;
      }

      // 2. Cria ou evolui a Perícia (Poder) na ficha do ator
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

      // 3. Registra o avanço no array nativo actor.system.advancements
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
      refreshTopCenterTrigger(this.actor);

      // Se ainda restarem pontos pendentes, permanece na árvore para distribuir os próximos; senão fecha
      const remaining = getPendingLevelInfo(this.actor).pending;
      if (remaining > 0) {
        this.renderTreeStage();
      } else {
        this.close();
      }
    } catch (err) {
      console.error("fu-level-up-wizard | Erro ao aplicar avanço de nível:", err);
      ui.notifications.error("Erro ao salvar o avanço de nível. Verifique o console (F12).");
    }
  }
}