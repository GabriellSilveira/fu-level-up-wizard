import { FULevelUpWizard, getPendingLevelInfo } from "./levelup-wizard.js";

const MODULE_ID = "fu-level-up-wizard";

/**
 * Encontra o personagem ativo/principal do usuário atual que possui níveis pendentes.
 */
function findActorWithPendingLevel() {
  if (!game.user) return null;

  const assigned = game.user.character;
  if (assigned && assigned.type === "character") {
    const info = getPendingLevelInfo(assigned);
    if (info.pending > 0) return assigned;
  }

  const controlled = canvas?.tokens?.controlled ?? [];
  for (const token of controlled) {
    const actor = token.actor;
    if (actor && actor.type === "character" && actor.isOwner) {
      const info = getPendingLevelInfo(actor);
      if (info.pending > 0) return actor;
    }
  }

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
 * Cria ou atualiza o botão ornamentado no centro superior da tela.
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
    <button type="button" class="fu-ornate-hud-btn" title="Abrir Assistente de Evolução de Nível">
      <svg class="fu-ornate-frame-svg" viewBox="0 0 600 92" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="fuMetalBorder" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#8c8275" />
            <stop offset="25%" stop-color="#d6cbb8" />
            <stop offset="50%" stop-color="#f5ecd8" />
            <stop offset="75%" stop-color="#d6cbb8" />
            <stop offset="100%" stop-color="#8c8275" />
          </linearGradient>
          <linearGradient id="fuInnerSilk" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#282230" />
            <stop offset="50%" stop-color="#15121a" />
            <stop offset="100%" stop-color="#0b090e" />
          </linearGradient>
        </defs>

        <path d="M 46 22 L 554 22 L 568 46 L 554 70 L 46 70 L 32 46 Z" fill="url(#fuInnerSilk)" />

        <path d="M 44 20 L 274 20 L 300 5 L 326 20 L 556 20 L 574 46 L 556 72 L 326 72 L 300 82 L 274 72 L 44 72 L 26 46 Z"
              fill="none" stroke="url(#fuMetalBorder)" stroke-width="3" stroke-linejoin="round" />

        <path d="M 52 26 L 548 26 L 562 46 L 548 66 L 52 66 L 38 46 Z"
              fill="none" stroke="rgba(250, 204, 21, 0.32)" stroke-width="1.2" />

        <path d="M 44 20 C 26 16, 16 8, 12 22 C 22 28, 26 36, 26 46 C 26 56, 22 64, 12 70 C 16 84, 26 76, 44 72"
              fill="none" stroke="url(#fuMetalBorder)" stroke-width="2.6" stroke-linecap="round" />
        <path d="M 26 46 L 4 46 L 18 39 M 4 46 L 18 53"
              fill="none" stroke="url(#fuMetalBorder)" stroke-width="2" stroke-linecap="round" />

        <path d="M 556 20 C 574 16, 584 8, 588 22 C 578 28, 574 36, 574 46 C 574 56, 578 64, 588 70 C 584 84, 574 76, 556 72"
              fill="none" stroke="url(#fuMetalBorder)" stroke-width="2.6" stroke-linecap="round" />
        <path d="M 574 46 L 596 46 L 582 39 M 596 46 L 582 53"
              fill="none" stroke="url(#fuMetalBorder)" stroke-width="2" stroke-linecap="round" />

        <path d="M 115 72 L 106 86 L 126 72" fill="url(#fuMetalBorder)" />
        <path d="M 485 72 L 494 86 L 474 72" fill="url(#fuMetalBorder)" />

        <polygon points="300,7 310,17 300,27 290,17" fill="#18141f" stroke="url(#fuMetalBorder)" stroke-width="2.2" />
        <circle cx="300" cy="17" r="2.5" fill="#facc15" />
      </svg>

      <div class="fu-ornate-content">
        <div class="fu-ornate-avatar-wrap">
          <img class="fu-ornate-avatar" src="${targetActor.img}" alt="${targetActor.name}" />
        </div>

        <div class="fu-ornate-text">
          <span class="fu-ornate-kicker">✦ EVOLUÇÃO DISPONÍVEL ✦</span>
          <strong class="fu-ornate-title">${targetActor.name} — Nível ${info.nextLevel}</strong>
        </div>

        <div class="fu-ornate-badge" title="Pontos de nível pendentes">
          <span>+${info.pending}</span>
        </div>
      </div>
    </button>
  `;

  const btn = container.querySelector(".fu-ornate-hud-btn");
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

  if (info.pending > 0) {
    refreshTopCenterTrigger(actor);
  }

  root.querySelectorAll(".fu-sheet-levelup-banner, .fu-sheet-header-pill").forEach((el) => el.remove());

  if (info.pending <= 0) return;

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
