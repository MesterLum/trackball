<script lang="ts">
  import { onMount } from 'svelte';
  import {
    OPTIONS,
    PRESETS,
    defaults,
    coerce,
    createDesign,
    autofit,
    generateParts,
    generatePreviewParts,
    generateViews,
    setLanguage,
    optionApplies,
    translate,
  } from '@trackball/core';
  import type { Values, ModelPart, Adjustment } from '@trackball/core';
  import { BrowserRenderer } from '@trackball/renderer-browser';
  import type { RenderedPart } from '@trackball/renderer-browser';
  import { strToU8, zipSync } from 'fflate';
  import OptionControl from './components/OptionControl.svelte';
  import ModelViewer from './components/ModelViewer.svelte';

  const defaultValues = defaults();
  // Storage can be unavailable (private windows, blocked site data); the theme is only a convenience.
  const stored = {
    get(key: string) {
      try {
        return localStorage.getItem(key);
      } catch {
        return null;
      }
    },
    set(key: string, value: string | null) {
      try {
        if (value === null) localStorage.removeItem(key);
        else localStorage.setItem(key, value);
      } catch {}
    },
  };
  /** Shared links keep every valid setting; an invalid one falls back to its default alone. */
  function fromURL(): Values {
    let result = defaults();
    for (const [key, value] of new URLSearchParams(location.search)) {
      if (!(key in result)) continue;
      try {
        result = coerce({ ...result, [key]: value });
      } catch {}
    }
    return result;
  }
  const thumbnail = new URLSearchParams(location.search).has('thumbnail');
  const initialValues = fromURL();
  let values = $state<Values>(initialValues),
    autoFit = $state(true),
    autoRender = $state(true);
  let language = $state<'en' | 'es'>(new URLSearchParams(location.search).get('lang') === 'es' ? 'es' : 'en');
  const systemDark = matchMedia('(prefers-color-scheme: dark)');
  let prefersDark = $state(systemDark.matches);
  let themeChoice = $state<'light' | 'dark' | null>(
    stored.get('theme') === 'light' ? 'light' : stored.get('theme') === 'dark' ? 'dark' : null,
  );
  let dark = $derived(themeChoice ? themeChoice === 'dark' : prefersDark);
  const groups = [...new Set(OPTIONS.map((o) => o.group))];
  let tab = $state(groups[0]),
    explode = $state(0),
    showBall = $state(true);
  let visible = $state<Record<string, boolean>>({
    cup: true,
    carrier: true,
    tray: true,
    palmrest: true,
    palm_key: true,
    mcu_clamp: true,
    hardware: false,
  });
  const partColors: Record<string, string> = {
    cup: '#4682b4',
    carrier: '#daa520',
    tray: '#808080',
    palmrest: '#cd853f',
    palm_key: '#008080',
    mcu_clamp: '#5b6ee1',
    hardware: '#2d986c',
  };
  let parts = $state<RenderedPart[]>([]),
    busy = $state(false),
    exporting = $state(false),
    status = $state(''),
    error = $state(''),
    toast = $state('');
  let past = $state<string[]>([]),
    future = $state<string[]>([]),
    lastSnapshot = JSON.stringify(initialValues);
  let viewer = $state<ModelViewer>();
  // Preview and export use the same $fn, so one renderer lets downloads reuse the preview cache.
  const renderer = new BrowserRenderer();
  let renderSequence = 0,
    renderedFor = '';
  const runtimeUrl = new URL(import.meta.env.BASE_URL + 'openscad/', location.origin).href;
  let calculated = $derived.by(() => {
    language;
    setLanguage(language);
    try {
      const fitted = autoFit ? autofit(values) : { values: coerce(values), changes: [] as Adjustment[] };
      const design = createDesign(fitted.values);
      return {
        design,
        values: fitted.values,
        changes: fitted.changes,
        problems: design.validate() as string[],
        error: '',
      };
    } catch (e) {
      return {
        design: null,
        values,
        changes: [] as Adjustment[],
        problems: [] as string[],
        error: String(e),
      };
    }
  });
  let fits = $derived(Boolean(calculated.design && !calculated.error && !calculated.problems.length));
  let t = $derived.by(() => {
    const locale = language;
    return (s: string) => translate(s, locale);
  });
  const PART_LABELS: Record<string, string> = {
    palm_key: 'retaining key',
    palmrest: 'palm rest',
    mcu_clamp: 'controller clamp',
  };
  const partLabel = (name: string) => t(PART_LABELS[name] ?? name);
  function recordChange() {
    const next = JSON.stringify(values);
    if (next !== lastSnapshot) {
      past = [...past.slice(-99), lastSnapshot];
      future = [];
      lastSnapshot = next;
    }
  }
  function apply(next: Values) {
    past = [...past.slice(-99), JSON.stringify(values)];
    future = [];
    values = coerce(next);
    lastSnapshot = JSON.stringify(values);
  }
  function undo() {
    if (!past.length) return;
    future = [...future, JSON.stringify(values)];
    values = JSON.parse(past.at(-1)!);
    past = past.slice(0, -1);
    lastSnapshot = JSON.stringify(values);
  }
  function redo() {
    if (!future.length) return;
    past = [...past, JSON.stringify(values)];
    values = JSON.parse(future.at(-1)!);
    future = future.slice(0, -1);
    lastSnapshot = JSON.stringify(values);
  }
  function urlFor(config: Values) {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(config))
      if (String(value) !== String(defaultValues[key]) && String(value) !== '') query.set(key, String(value));
    if (language === 'es') query.set('lang', 'es');
    return location.pathname + (query.size ? '?' + query : '');
  }
  async function share() {
    try {
      await navigator.clipboard.writeText(location.origin + urlFor(calculated.values));
      toast = t('Link copied');
    } catch {
      toast = t('Could not copy link');
    }
  }
  function download(name: string, data: BlobPart, type = 'application/octet-stream') {
    const url = URL.createObjectURL(new Blob([data], { type }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function bundleExtras(config: Values) {
    const d = createDesign(config);
    return {
      ...Object.fromEntries(Object.entries(generateViews(d)).map(([name, scad]) => [name, strToU8(scad)])),
      'design.json': strToU8(JSON.stringify(config, null, 2)),
      'summary.txt': strToU8(d.summary()),
      'bom.json': strToU8(JSON.stringify(d.bom(), null, 2)),
      'README.txt': strToU8(
        'Print cup and carrier in their exported orientation. Tray and palm-rest bases print floor down. For anchored mode, slide the rest toward the tray and press the retaining key into the underside. Test the anchor fit before a full print.',
      ),
    };
  }
  function downloadScad() {
    if (!fits) return;
    const config = { ...calculated.values },
      model = generateParts(createDesign(config));
    const files = {
      ...bundleExtras(config),
      ...Object.fromEntries(model.map((p) => [p.name + '.scad', strToU8(p.scad)])),
    };
    download('trackball-scad.zip', zipSync(files).slice().buffer as ArrayBuffer, 'application/zip');
  }
  async function runPreview(config: Values, sequence: number) {
    if (sequence !== renderSequence || !fits) return;
    busy = true;
    error = '';
    status = t('Preparing preview');
    try {
      const model = generatePreviewParts(createDesign(config));
      const rendered = await renderer.render(model, runtimeUrl, (p) => {
        if (sequence === renderSequence)
          status = (p.state === 'rendering' ? t('Rendering') : t('Ready')) + ': ' + partLabel(p.name);
      });
      if (sequence === renderSequence) {
        parts = rendered;
        renderedFor = JSON.stringify(config);
        status = t('Preview ready');
      }
    } catch (e) {
      if ((e as Error).name !== 'AbortError' && sequence === renderSequence) {
        error = String(e);
        status = t('Rendering failed');
      }
    } finally {
      if (sequence === renderSequence) busy = false;
    }
  }
  async function renderNow() {
    const seq = ++renderSequence;
    await runPreview({ ...calculated.values }, seq);
  }
  async function downloadStls() {
    if (!fits) return;
    exporting = true;
    renderer.cancel();
    busy = false;
    error = '';
    const config = { ...calculated.values };
    try {
      const model = generateParts(createDesign(config));
      const rendered = await renderer.render(
        model,
        runtimeUrl,
        (p) => (status = t('Preparing download') + ': ' + partLabel(p.name)),
      );
      const files = {
        ...bundleExtras(config),
        ...Object.fromEntries(rendered.map((p) => [p.name + '.stl', p.bytes])),
      };
      download('trackball-stl.zip', zipSync(files).slice().buffer as ArrayBuffer, 'application/zip');
      toast = t('Download ready');
      status = t('Download ready');
    } catch (e) {
      if ((e as Error).name !== 'AbortError') {
        error = String(e);
        status = t('Download failed');
      }
    } finally {
      exporting = false;
    }
  }
  $effect(() => {
    document.documentElement.dataset.theme = dark ? 'bench-dark' : 'bench';
    stored.set('theme', themeChoice);
  });
  $effect(() => {
    document.documentElement.lang = language;
  });
  $effect(() => {
    if (thumbnail) return;
    history.replaceState(null, '', urlFor(values));
  });
  $effect(() => {
    const config = { ...calculated.values },
      valid = fits;
    const stale = JSON.stringify(config) !== renderedFor;
    if (!autoRender || !valid || exporting) {
      if (!autoRender && valid && !exporting && !busy && parts.length && stale)
        status = t('Changes not rendered yet');
      return;
    }
    if (!stale) return;
    const sequence = ++renderSequence;
    status = t('Preparing preview');
    const timer = setTimeout(() => runPreview(config, sequence), 350);
    return () => {
      clearTimeout(timer);
      // Only stop this preview; the shared renderer may be busy with a download by now.
      if (busy && sequence === renderSequence) renderer.cancel();
    };
  });
  $effect(() => {
    if (!toast) return;
    const timer = setTimeout(() => (toast = ''), 3000);
    return () => clearTimeout(timer);
  });
  onMount(() => {
    const follow = (e: MediaQueryListEvent) => (prefersDark = e.matches);
    systemDark.addEventListener('change', follow);
    return () => {
      systemDark.removeEventListener('change', follow);
      renderer.cancel();
    };
  });
</script>


<svelte:window
  onkeydown={(e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !(e.target instanceof HTMLInputElement)) {
      e.preventDefault();
      e.shiftKey ? redo() : undo();
    }
  }}
  onpopstate={() => {
    values = fromURL();
    lastSnapshot = JSON.stringify(values);
  }}
/>
{#if thumbnail}
  <ModelViewer
    {parts}
    tilt={Number(calculated.values.tilt)}
    tent={Number(calculated.values.tent)}
    ballRadius={Number(calculated.values.ball) / 2}
    floor={calculated.design?.z_floor_bottom ?? -40}
    visible={{ ...visible, hardware: false }}
    showGrid={false}
    fill
    onframe={() => (document.documentElement.dataset.framed = String(parts.length))}
  />
{:else}
  <div class="page-shell">
    <header class="flex flex-wrap items-end justify-between gap-4 pb-5">
      <div>
        <h1 class="wide text-2xl sm:text-[1.75rem] font-bold leading-tight">Ridekay Trackball</h1>
        <p class="muted text-sm mt-1">{t('Configure, preview and download a printable trackball.')}</p>
      </div>
      <div class="flex gap-2 items-center">
        <select aria-label="Language" class="select select-sm w-28" bind:value={language}
          ><option value="en">English</option><option value="es">Español</option></select
        ><button
          class="btn btn-sm btn-square btn-ghost"
          aria-label={t('Toggle theme')}
          title={t('Toggle theme')}
          onclick={() => (themeChoice = dark ? 'light' : 'dark')}
        >
          {#if dark}<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8"
              ><circle cx="12" cy="12" r="4" /><path
                d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"
              /></svg
            >{:else}<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8"
              ><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" /></svg
            >{/if}
        </button><button class="btn btn-sm" onclick={share}>{t('Share link')}</button>
      </div>
    </header>
    <div class="config-layout">
      <aside class="panel settings-panel">
        <div class="p-4 pb-3">
          <h2 class="sr-only">{t('Configuration')}</h2>
          <div class="segmented" role="tablist">
            {#each groups as group}<button role="tab" aria-selected={tab === group} onclick={() => (tab = group)}
                >{t(group)}</button
              >{/each}
          </div>
        </div>
        <fieldset class="settings-scroll px-5" disabled={exporting}>
          {#each OPTIONS.filter((o) => o.group === tab) as option}{#if optionApplies(option.name, values)}<OptionControl
                {option}
                bind:value={values[option.name]}
                onchange={recordChange}
                {t}
              />{/if}{/each}
        </fieldset>
        <div class="p-3 border-t border-base-300 flex gap-1">
          <button class="btn btn-sm btn-ghost" disabled={!past.length || exporting} onclick={undo}>{t('Undo')}</button
          ><button class="btn btn-sm btn-ghost" disabled={!future.length || exporting} onclick={redo}
            >{t('Redo')}</button
          ><button class="btn btn-sm btn-ghost ml-auto" disabled={exporting} onclick={() => apply(defaults())}
            >{t('Reset')}</button
          >
        </div>
      </aside>
      <main class="min-w-0 space-y-4">
        <section class="panel" aria-label={t('Your model')}>
          <div class="relative">
            <ModelViewer
              bind:this={viewer}
              {parts}
              tilt={Number(calculated.values.tilt)}
              tent={Number(calculated.values.tent)}
              ballRadius={Number(calculated.values.ball) / 2}
              floor={calculated.design?.z_floor_bottom ?? -40}
              {explode}
              {visible}
              {showBall}
              {dark}
            />
            <div class="absolute top-3 right-3 flex gap-1">
              <button
                class="btn btn-sm btn-square bg-base-100"
                aria-label={t('Fit view')}
                title={t('Fit view')}
                onclick={() => viewer?.fit()}
                ><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"
                  ><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /></svg
                ></button
              ><button
                class="btn btn-sm btn-square bg-base-100"
                aria-label={t('Save PNG')}
                title={t('Save PNG')}
                onclick={() => viewer?.snapshot()}
                ><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"
                  ><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></svg
                ></button
              >
            </div>
          </div>
          <div class="px-4 py-3 border-t border-base-300 flex flex-wrap gap-2 items-center">
            {#each Object.keys(visible).filter((n) => n === 'hardware' || n === 'cup' || n === 'carrier' || n === 'tray' || parts.some((p) => p.name === n)) as name}<label
                class="part-chip"
                style={`--swatch:${partColors[name]}`}
                ><input type="checkbox" bind:checked={visible[name]} /><span class="swatch"></span>{partLabel(
                  name,
                )}</label
              >{/each}<label class="part-chip" style="--swatch:#c81e3c"
              ><input type="checkbox" bind:checked={showBall} /><span class="swatch"></span>{t('ball')}</label
            ><label class="flex items-center gap-2 ml-auto text-xs muted"
              >{t('Explode')}<input
                aria-label={t('Explode')}
                type="range"
                class="range range-xs w-24"
                min="0"
                max="25"
                step="1"
                bind:value={explode}
              /></label
            >
          </div>
          {#if calculated.design}<dl class="readout">
              <div>
                <dt>{t('Body footprint')}</dt>
                <dd class="wide">
                  {calculated.design.footprint[0].toFixed(1)} × {calculated.design.footprint[1].toFixed(1)}<small
                    >mm</small
                  >
                </dd>
              </div>
              <div>
                <dt>{t('Height')}</dt>
                <dd class="wide">
                  {(calculated.design.ball.r - calculated.design.z_floor_bottom).toFixed(1)}<small>mm</small>
                </dd>
              </div>
              <div>
                <dt>{t('controller')}</dt>
                <dd class="wide">{calculated.values.mcu}<small>{t(String(calculated.values.mcu_place))}</small></dd>
              </div>
              <div>
                <dt>{t('Fit')}</dt>
                <dd class="wide" class:text-success={fits} class:text-warning={!fits}>
                  {fits ? t('Ready') : t('Needs adjustment')}
                </dd>
              </div>
            </dl>{/if}
          <div class="px-4 py-3 bg-base-200 border-t border-base-300 flex flex-wrap items-center justify-between gap-3">
            <div class="text-sm flex items-center gap-2">
              {#if busy || exporting}<span class="loading loading-spinner loading-xs"></span>{:else}<span
                  class="status-dot"
                  class:idle={!parts.length}
                ></span>{/if}<span role="status">{status || t('Ready to render')}</span>
            </div>
            <div class="flex flex-wrap gap-2">
              {#if busy || exporting}<button
                  class="btn btn-sm btn-ghost"
                  onclick={() => {
                    renderer.cancel();
                    busy = false;
                    exporting = false;
                    status = t('Cancelled');
                  }}>{t('Cancel')}</button
                >{/if}{#if !autoRender}<button
                  class="btn btn-sm"
                  disabled={!fits || exporting}
                  onclick={renderNow}>{t('Render')}</button
                >{/if}<button class="btn btn-sm" disabled={!fits || exporting} onclick={downloadScad}
                >{t('Download SCAD')}</button
              ><button class="btn btn-primary btn-sm" disabled={!fits || exporting} onclick={downloadStls}
                >{exporting ? t('Preparing download') : t('Download STLs')}</button
              >
            </div>
          </div>
        </section>
        <div class="flex flex-wrap items-center gap-5 text-sm px-1">
          <label class="flex items-center gap-2"
            ><input type="checkbox" class="toggle toggle-xs toggle-primary" bind:checked={autoRender} />{t(
              'Auto render',
            )}</label
          ><label class="flex items-center gap-2"
            ><input type="checkbox" class="toggle toggle-xs toggle-primary" bind:checked={autoFit} />{t(
              'Auto fit',
            )}</label
          ><span class="muted text-xs ml-auto">{t('Models are generated on your device.')}</span>
        </div>
        {#if calculated.changes.length}<div class="alert text-sm">
            <div>
              <strong>{t('Adjusted to fit')}: </strong>{calculated.changes
                .map((c) => `${c.option}: ${c.from} → ${c.to}`)
                .join(', ')}
            </div>
            <button class="btn btn-xs" onclick={() => (autoFit = false)}>{t('Undo adjustment')}</button>
          </div>{/if}
        {#if calculated.error || error}<div class="alert alert-error text-sm" role="alert">
            <pre class="whitespace-pre-wrap break-all">{calculated.error || error}</pre>
          </div>{/if}
        {#if calculated.problems.length}<div class="alert alert-warning text-sm" role="alert">
            <div>
              <strong>{t('This configuration does not fit')}</strong>
              <ul class="list-disc ml-5 mt-1">
                {#each calculated.problems as problem}<li>{problem}</li>{/each}
              </ul>
            </div>
          </div>{/if}
        {#if calculated.design}<section class="panel">
            <details open class="border-b border-base-300">
              <summary class="px-5 py-3.5 font-semibold cursor-pointer">{t('Parts to buy')}</summary>
              <div class="overflow-x-auto px-2 pb-3">
                <table class="table table-sm bom">
                  <thead><tr><th class="w-12">{t('Qty')}</th><th>{t('Part')}</th><th>{t('Notes')}</th></tr></thead
                  ><tbody
                    >{#each calculated.design.bom() as item}<tr
                        ><td class="font-semibold">{item.qty}</td><td>{item.item}</td><td class="muted"
                          >{item.note}</td
                        ></tr
                      >{/each}</tbody
                  >
                </table>
              </div>
            </details>
            <details>
              <summary class="px-5 py-3.5 font-semibold cursor-pointer">{t('Dimensions and assumptions')}</summary>
              <pre class="px-5 pb-4 text-xs whitespace-pre-wrap muted">{calculated.design.summary()}</pre>
            </details>
          </section>{/if}
        <section class="pt-2">
          <h2 class="font-semibold mb-3 px-1">{t('Start with a preset')}</h2>
          <div class="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {#each PRESETS as preset}<button
                class="preset"
                disabled={exporting}
                onclick={() => apply({ ...defaults(), ...preset.values } as Values)}
                ><div class="thumb">
                  <img
                    src={import.meta.env.BASE_URL + 'presets/' + preset.key + '.webp'}
                    alt=""
                    loading="lazy"
                    onerror={(e) => ((e.currentTarget as HTMLImageElement).hidden = true)}
                  />
                </div>
                <div class="p-3.5">
                  <h3 class="font-semibold">{t(preset.title)}</h3>
                  <p class="muted text-xs leading-relaxed mt-1">{t(preset.blurb)}</p>
                </div></button
              >{/each}
          </div>
        </section>
      </main>
    </div>
    <footer class="muted text-xs mt-10 pt-4 border-t border-base-300 flex flex-wrap gap-x-5 gap-y-1">
      <span>{t('Free software under the GNU GPL, version 3 or later.')}</span>
      <a class="link" href="https://github.com/MesterLum/trackball">{t('Source code')}</a>
      <a class="link" href={import.meta.env.BASE_URL + 'THIRD_PARTY_LICENSES.txt'}>{t('Third-party licenses')}</a>
    </footer>
  </div>
{/if}
{#if toast}<div class="toast toast-end"><div class="alert alert-info">{toast}</div></div>{/if}
