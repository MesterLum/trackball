<script lang="ts">
  let {
    value,
    onpick,
    t,
    disabled = false,
  }: {
    value: string;
    /** Called with the build the person picked (only when it differs from the current one). */
    onpick: (build: string) => void;
    t: (s: string) => string;
    disabled?: boolean;
  } = $props();
  const BUILDS = [
    { key: 'full', name: 'Full trackball', line: 'Buttons, palm rest and tilt' },
    { key: 'cradle', name: 'Cradle pod', line: 'Ball-only, notched cup' },
    { key: 'pod', name: 'Rounded pod', line: 'Ball-only pebble' },
  ];
  function keydown(event: KeyboardEvent, index: number) {
    const step =
      event.key === 'ArrowRight' || event.key === 'ArrowDown'
        ? 1
        : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
          ? -1
          : 0;
    if (!step) return;
    event.preventDefault();
    const next = BUILDS[(index + step + BUILDS.length) % BUILDS.length];
    onpick(next.key);
    (event.currentTarget as HTMLElement).parentElement
      ?.querySelector<HTMLElement>(`[data-build="${next.key}"]`)
      ?.focus();
  }
</script>

<div class="build-picker">
  <p id="build-label" class="label-text">{t('What are you building?')}</p>
  <div class="cards" role="radiogroup" aria-labelledby="build-label">
    {#each BUILDS as build, index (build.key)}<button
        type="button"
        role="radio"
        data-build={build.key}
        aria-checked={value === build.key}
        tabindex={value === build.key ? 0 : -1}
        title={t('Switching starts this build from its defaults')}
        {disabled}
        onclick={() => value !== build.key && onpick(build.key)}
        onkeydown={(e) => keydown(e, index)}
      >
        <svg viewBox="0 0 64 40" aria-hidden="true">
          {#if build.key === 'full'}
            <rect class="body" x="5" y="24" width="54" height="11" rx="3" />
            <rect class="key" x="9" y="20.5" width="9" height="4" rx="1" />
            <rect class="key" x="20" y="20.5" width="9" height="4" rx="1" />
            <path class="body" d="M35 24 l2 -5 h14 l2 5 z" />
            <circle class="ball" cx="44" cy="14" r="8" />
          {:else if build.key === 'cradle'}
            <rect class="body" x="13" y="25" width="38" height="11" rx="3.5" />
            <path class="body" d="M20 25 q0 -2 2 -2 h2 v-5 h16 v5 h2 q2 0 2 2 z" />
            <circle class="ball" cx="32" cy="12.5" r="8.5" />
            <path class="notch" d="M28 18 q4 5 8 0" />
          {:else}
            <path class="body" d="M10 36 q0 -18 22 -18 q22 0 22 18 z" />
            <circle class="ball" cx="32" cy="12.5" r="8.5" />
          {/if}
        </svg>
        <span class="name">{t(build.name)}</span>
        <span class="line">{t(build.line)}</span>
      </button>{/each}
  </div>
</div>

<style>
  .build-picker {
    display: grid;
    gap: 0.5rem;
  }
  .label-text {
    font-size: 0.8125rem;
    font-weight: 600;
  }
  .cards {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.5rem;
  }
  button {
    display: grid;
    justify-items: start;
    align-content: start;
    gap: 0.125rem;
    padding: 0.5rem 0.625rem 0.625rem;
    text-align: left;
    border: 1px solid var(--line);
    border-radius: var(--radius-field);
    background: var(--color-base-100);
    color: var(--color-base-content);
    transition:
      border-color 120ms,
      box-shadow 120ms;
  }
  button:hover:not(:disabled) {
    border-color: color-mix(in srgb, var(--color-primary) 60%, var(--line));
  }
  button:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 2px;
  }
  button[aria-checked='true'] {
    border-color: var(--color-primary);
    box-shadow: inset 0 -2px 0 var(--color-primary);
  }
  svg {
    width: 100%;
    height: auto;
    max-height: 3rem;
    margin-bottom: 0.25rem;
  }
  .body {
    fill: var(--color-base-200);
    stroke: currentColor;
    stroke-width: 1.4;
    stroke-linejoin: round;
    opacity: 0.85;
  }
  .key {
    fill: var(--color-base-100);
    stroke: currentColor;
    stroke-width: 1.2;
    opacity: 0.85;
  }
  .ball {
    fill: color-mix(in srgb, var(--muted) 35%, transparent);
    stroke: currentColor;
    stroke-width: 1.4;
  }
  .notch {
    fill: none;
    stroke: currentColor;
    stroke-width: 1.2;
    opacity: 0.6;
  }
  button[aria-checked='true'] .ball {
    fill: var(--color-primary);
  }
  .name {
    font-size: 0.8125rem;
    font-weight: 600;
    line-height: 1.2;
  }
  .line {
    font-size: 0.6875rem;
    line-height: 1.3;
    color: var(--muted);
  }
  @media (prefers-reduced-motion: reduce) {
    button {
      transition: none;
    }
  }
</style>
