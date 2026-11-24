import { FULevelUpWizard, getPendingLevelInfo } from "./levelup-wizard.js";

const MODULE_ID = "fu-level-up-wizard";

/**
 * Encontra o personagem ativo/principal do usuário atual que possui níveis pendentes.
 */
function findActorWithPendingLevel() {
  if (!game.user) return null;

  // 1. Prioriza o personagem vinculado ao usuário (Player)
  const assigned = game.user.character;
  if (assigned && assigned.type === "character") {
    const info = getPendingLevelInfo(assigned);
    if (info.pending > 0) return assigned;
  }

  // 2. Verifica tokens selecionados no canvas que o usuário é dono
  const controlled = canvas?.tokens?.controlled ?? [];
  for (const token of controlled) {
    const actor = token.actor;
    if (actor && actor.type === "character" && actor.isOwner) {
      const info = getPendingLevelInfo(actor);
      if (info.pending > 0) return actor;
    }
  }

  // 3. Se não for GM, verifica qualquer personagem em que o jogador tenha permissão de OWNER
  if (!game.user.isGM) {
    const owned = game.actors?.filter((a) => a.type === "character" && a.isOwner) ?? [];
    for (const actor of owned) {
      const info = getPendingLevelInfo(actor);
      if (info.pending > 0) return actor;
    }
  }

  return null;
}

/**
 * Cria ou atualiza o botão de destaque no centro superior da tela.
 */
export function refreshTopCenterTrigger(preferredActor = null) {
  let container = document.getElementById("fu-levelup-hud-trigger");

  let targetActor = preferredActor;
  if (targetActor) {
    const check = getPendingLevelInfo(targetActor);
    if (check.pending <= 0) targetActor = null;
  }
  if (!targetActor) {
    targetActor = findActorWithPendingLevel();
  }

  if (!targetActor) {
    if (container) container.remove();
    return;
  }

  const info = getPendingLevelInfo(targetActor);

  if (!container) {
    container = document.createElement("div");
    container.id = "fu-levelup-hud-trigger";
    document.body.appendChild(container);
  }

  container.innerHTML = `
    <button type="button" class="fu-hud-levelup-btn" title="Abrir Assistente de Evolução de Nível">
      <img class="fu-hud-avatar" src="${targetActor.img}" alt="${targetActor.name}" />
      <div class="fu-hud-text">
        <span class="fu-hud-kicker">✦ EVOLUÇÃO DISPONÍVEL</span>
        <strong class="fu-hud-title">${targetActor.name} — Nível ${info.nextLevel}</strong>
      </div>
      <span class="fu-hud-badge">+${info.pending}</span>
    </button>
  `;

  const btn = container.querySelector(".fu-hud-levelup-btn");
  btn.onclick = (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    FULevelUpWizard.open(targetActor);
  };
}

/**
 * Injeta o botão de destaque na aba Nível / Avanços da ficha do personagem.
 */
function injectSheetTrigger(app, html) {
  const actor = app?.actor;
  if (!actor || actor.type !== "character" || !actor.isOwner) return;

  const info = getPendingLevelInfo(actor);
  const root = html instanceof HTMLElement ? html : html[0];
  if (!root) return;

  // Atualiza também o gatilho superior da tela se a ficha aberta tiver nível pendente
  if (info.pending > 0) {
    refreshTopCenterTrigger(actor);
  }

  // Remove injeções antigas para evitar duplicidade
  root.querySelectorAll(".fu-sheet-levelup-banner, .fu-sheet-header-pill").forEach((el) => el.remove());

  if (info.pending <= 0) return;

  // Indicador discreto no cabeçalho da ficha
  const header = root.querySelector(".sheet-header, header.window-header");
  if (header) {
    const pill = document.createElement("button");
    pill.type = "button";
    pill.className = "fu-sheet-header-pill";
    pill.innerHTML = `<i class="fas fa-arrow-up"></i> Nível Pendente (+${info.pending})`;
    pill.onclick = (e) => {
      e.preventDefault();
      FULevelUpWizard.open(actor);
    };
    header.appendChild(pill);
  }

  // Botão de destaque na área de Avanços / Nível
  const advancementsTab =
    root.querySelector('.tab[data-tab="advancements"]') ||
    root.querySelector('.tab[data-tab="level"]') ||
    root.querySelector(".advancements");

  if (advancementsTab) {
    const banner = document.createElement("div");
    banner.className = "fu-sheet-levelup-banner";
    banner.innerHTML = `
      <div class="fu-sheet-banner-info">
        <span class="fu-sheet-banner-tag">NOVO NÍVEL DISPONÍVEL</span>
        <strong>Você possui ${info.pending} ponto(s) de nível pendente(s) (${info.filled} / ${info.totalLevel})</strong>
      </div>
      <button type="button" class="fu-sheet-banner-btn">
        <i class="fas fa-sparkles"></i> Abrir Tela de Level Up
      </button>
    `;
    banner.querySelector(".fu-sheet-banner-btn").onclick = (e) => {
      e.preventDefault();
      FULevelUpWizard.open(actor);
    };
    advancementsTab.prepend(banner);
  }
}

Hooks.once("init", () => {
  console.log(`${MODULE_ID} | Inicializando Assistente Visual de Level Up para Fabula Ultima.`);
});

Hooks.once("ready", () => {
  refreshTopCenterTrigger();
});

Hooks.on("renderActorSheet", (app, html) => {
  injectSheetTrigger(app, html);
});

Hooks.on("controlToken", () => {
  refreshTopCenterTrigger();
});

Hooks.on("updateActor", (actor) => {
  if (actor.type === "character") {
    refreshTopCenterTrigger(actor);
  }
});

Hooks.on("createItem", (item) => {
  if (item.parent?.type === "character") {
    refreshTopCenterTrigger(item.parent);
  }
});

Hooks.on("deleteItem", (item) => {
  if (item.parent?.type === "character") {
    refreshTopCenterTrigger(item.parent);
  }
});