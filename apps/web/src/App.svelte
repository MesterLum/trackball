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
    translate,
  } from '@trackball/core';
  import type { Values, ModelPart, Adjustment } from '@trackball/core';
  import { BrowserRenderer } from '@trackball/renderer-browser';
  import type { RenderedPart } from '@trackball/renderer-browser';
  import { strToU8, zipSync } from 'fflate';
  import OptionControl from './components/OptionControl.svelte';
  import ModelViewer from './components/ModelViewer.svelte';

  const defaultValues = defaults();
  function fromURL(): Values {
    const result = defaults();
    for (const [key, value] of new URLSearchParams(location.search)) if (key in result) result[key] = value;
    try {
      return coerce(result);
    } catch {
      return defaults();
    }
  }
  const initialValues = fromURL();
  let values = $state<Values>(initialValues),
    autoFit = $state(true),
    autoRender = $state(true);
  let language = $state<'en' | 'es'>(new URLSearchParams(location.search).get('lang') === 'es' ? 'es' : 'en');
  let theme = $state(localStorage.getItem('theme') || 'night');
  const groups = [...new Set(OPTIONS.map((o) => o.group))];
  let tab = $state(groups[0]),
    previewDetail = $state(48),
    explode = $state(0),
    showBall = $state(true);
  let visible = $state<Record<string, boolean>>({
    cup: true,
    carrier: true,
    tray: true,
    palmrest: true,
    palm_key: true,
    hardware: false,
  });
  let parts = $state<RenderedPart[]>([]),
    busy = $state(false),
    exporting = $state(false),
    status = $state(''),
    error = $state(''),
    toast = $state('');
  let past = $state<string[]>([]),
    future = $state<string[]>([]),
    lastSnapshot = JSON.stringify(initialValues);
  let viewer: ModelViewer;
  const previewRenderer = new BrowserRenderer(),
    exportRenderer = new BrowserRenderer();
  let renderSequence = 0;
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
  const partLabel = (name: string) =>
    t(name === 'palm_key' ? 'retaining key' : name === 'palmrest' ? 'palm rest' : name);
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
  async function runPreview(config: Values, quality: number, sequence: number) {
    if (sequence !== renderSequence || !fits) return;
    busy = true;
    error = '';
    status = t('Preparing preview');
    try {
      const model = generatePreviewParts(createDesign({ ...config, fn: quality }));
      const rendered = await previewRenderer.render(model, runtimeUrl, (p) => {
        if (sequence === renderSequence)
          status = (p.state === 'rendering' ? t('Rendering') : t('Ready')) + ': ' + partLabel(p.name);
      });
      if (sequence === renderSequence) {
        parts = rendered;
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
    await runPreview({ ...calculated.values }, previewDetail, seq);
  }
  async function downloadStls() {
    if (!fits) return;
    exporting = true;
    previewRenderer.cancel();
    busy = false;
    error = '';
    const config = { ...calculated.values };
    try {
      const model = generateParts(createDesign(config));
      const rendered = await exportRenderer.render(
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
      if ((e as Error).name !== 'AbortError') error = String(e);
    } finally {
      exporting = false;
    }
  }
  $effect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('theme', theme);
  });
  $effect(() => {
    document.documentElement.lang = language;
  });
  $effect(() => {
    history.replaceState(null, '', urlFor(values));
  });
  $effect(() => {
    const config = { ...calculated.values },
      quality = previewDetail,
      valid = fits;
    if (!autoRender || !valid || exporting) return;
    const sequence = ++renderSequence;
    const timer = setTimeout(() => runPreview(config, quality, sequence), 350);
    return () => {
      clearTimeout(timer);
      previewRenderer.cancel();
    };
  });
  $effect(() => {
    if (!toast) return;
    const timer = setTimeout(() => (toast = ''), 3000);
    return () => clearTimeout(timer);
  });
  onMount(() => () => {
    previewRenderer.cancel();
    exportRenderer.cancel();
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
<div class="page-shell">
  <header class="flex flex-wrap items-center justify-between gap-4 py-4 mb-5">
    <div>
      <div class="text-xs uppercase tracking-[.22em] opacity-50 mb-1">{t('Design · customize · print')}</div>
      <h1 class="text-2xl sm:text-3xl font-semibold tracking-tight">{t('Trackball configurator')}</h1>
      <p class="text-sm opacity-60 mt-1">{t('Make a trackball that fits your hand and hardware.')}</p>
    </div>
    <div class="flex gap-2 items-center">
      <select aria-label="Language" class="select select-sm w-28" bind:value={language}
        ><option value="en">English</option><option value="es">Español</option></select
      ><button
        class="btn btn-sm btn-ghost"
        aria-label={t('Toggle theme')}
        onclick={() => (theme = theme === 'night' ? 'light' : 'night')}
        >{theme === 'night' ? '☀' : '☾'}</button
      ><button class="btn btn-sm" onclick={share}>{t('Share link')}</button>
    </div>
  </header>
  <div class="config-layout">
    <aside class="panel bg-base-100 settings-panel">
      <div class="p-4 border-b border-base-300">
        <h2 class="font-semibold mb-3">{t('Configuration')}</h2>
        <div class="flex flex-wrap gap-1" role="tablist">
          {#each groups as group}<button
              class:btn-primary={tab === group}
              class="btn btn-xs"
              role="tab"
              aria-selected={tab === group}
              onclick={() => (tab = group)}>{t(group)}</button
            >{/each}
        </div>
      </div>
      <fieldset class="px-5 pb-4" disabled={exporting}>
        {#each OPTIONS.filter((o) => o.group === tab) as option}{#if option.name !== 'palm_attachment' || Number(values.palm) > 0}<OptionControl
              {option}
              bind:value={values[option.name]}
              onchange={recordChange}
              {t}
            />{/if}{/each}
      </fieldset>
      <div class="p-4 border-t border-base-300 flex gap-2">
        <button class="btn btn-sm" disabled={!past.length || exporting} onclick={undo}>{t('Undo')}</button
        ><button class="btn btn-sm" disabled={!future.length || exporting} onclick={redo}>{t('Redo')}</button
        ><button class="btn btn-sm btn-ghost ml-auto" disabled={exporting} onclick={() => apply(defaults())}
          >{t('Reset')}</button
        >
      </div>
    </aside>
    <main class="min-w-0 space-y-4">
      <section class="panel bg-base-100">
        <div class="p-4 flex flex-wrap justify-between items-center gap-3">
          <h2 class="font-semibold">{t('Your model')}</h2>
          <div class="flex flex-wrap gap-2 items-center">
            <select aria-label={t('Preview detail')} class="select select-xs w-32" bind:value={previewDetail}
              ><option value={24}>{t('Fast preview')}</option><option value={48}>{t('Balanced')}</option
              ><option value={96}>{t('Fine preview')}</option></select
            ><button class="btn btn-xs btn-ghost" onclick={() => viewer?.fit()}>{t('Fit view')}</button
            ><button class="btn btn-xs btn-ghost" onclick={() => viewer?.snapshot()}>{t('Save PNG')}</button>
          </div>
        </div>
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
        />
        <div class="px-4 py-3 border-t border-base-300 flex flex-wrap gap-4 items-center text-xs">
          {#each Object.keys(visible) as name}<label class="flex items-center gap-1.5"
              ><input type="checkbox" class="checkbox checkbox-xs" bind:checked={visible[name]} />{partLabel(
                name,
              )}</label
            >{/each}<label class="flex items-center gap-1.5"
            ><input type="checkbox" class="checkbox checkbox-xs" bind:checked={showBall} />{t('ball')}</label
          ><label class="flex items-center gap-2 ml-auto"
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
        <div class="px-4 py-4 bg-base-200 flex flex-wrap items-center justify-between gap-3">
          <div class="text-sm flex items-center gap-2">
            {#if busy || exporting}<span class="loading loading-spinner loading-xs"></span>{:else}<span
                class="status-dot"
              ></span>{/if}<span role="status">{status || t('Ready to render')}</span>
          </div>
          <div class="flex gap-2">
            <button class="btn btn-sm" disabled={!fits || exporting} onclick={renderNow}>{t('Render')}</button
            ><button class="btn btn-sm" disabled={!fits || exporting} onclick={downloadScad}>SCAD</button
            ><button class="btn btn-primary btn-sm" disabled={!fits || exporting} onclick={downloadStls}
              >{exporting ? t('Preparing download') : t('Download STLs')}</button
            >{#if busy || exporting}<button
                class="btn btn-sm btn-ghost"
                onclick={() => {
                  previewRenderer.cancel();
                  exportRenderer.cancel();
                  busy = false;
                  exporting = false;
                  status = t('Cancelled');
                }}>{t('Cancel')}</button
              >{/if}
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
        ><span class="text-xs opacity-50 ml-auto">{t('Models are generated on your device.')}</span>
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
      {#if calculated.design}<section class="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div class="stat panel bg-base-100">
            <div class="stat-title">{t('Body footprint')}</div>
            <div class="stat-value text-xl">
              {calculated.design.footprint[0].toFixed(1)} × {calculated.design.footprint[1].toFixed(1)}
            </div>
            <div class="stat-desc">mm</div>
          </div>
          <div class="stat panel bg-base-100">
            <div class="stat-title">{t('Height')}</div>
            <div class="stat-value text-xl">
              {(calculated.design.ball.r - calculated.design.z_floor_bottom).toFixed(1)}
            </div>
            <div class="stat-desc">mm</div>
          </div>
          <div class="stat panel bg-base-100">
            <div class="stat-title">{t('controller')}</div>
            <div class="stat-value text-xl">{calculated.values.mcu}</div>
            <div class="stat-desc">{t(String(calculated.values.mcu_place))}</div>
          </div>
          <div class="stat panel bg-base-100">
            <div class="stat-title">{t('Fit')}</div>
            <div class="stat-value text-xl" class:text-success={fits}>
              {fits ? t('Ready') : t('Needs adjustment')}
            </div>
            <div class="stat-desc">{parts.length} {t('rendered parts')}</div>
          </div>
        </section>{/if}
      <section class="panel bg-base-100 p-5">
        <h2 class="font-semibold mb-4">{t('Start with a preset')}</h2>
        <div class="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {#each PRESETS as preset}<button
              class="text-left rounded-xl border border-base-300 p-3 hover:border-primary transition-colors"
              disabled={exporting}
              onclick={() => apply({ ...defaults(), ...preset.values } as Values)}
              ><img
                class="w-full h-28 object-cover rounded-lg mb-3"
                src={import.meta.env.BASE_URL + 'presets/' + preset.key + '.jpg'}
                alt={t(preset.title)}
                loading="lazy"
              />
              <h3 class="font-medium">{t(preset.title)}</h3>
              <p class="text-xs opacity-60 leading-relaxed mt-1">{t(preset.blurb)}</p></button
            >{/each}
        </div>
      </section>
      {#if calculated.design}<details class="panel bg-base-100 p-5">
          <summary class="font-semibold cursor-pointer">{t('Parts to buy')}</summary>
          <div class="overflow-x-auto mt-3">
            <table class="table table-sm">
              <thead><tr><th>{t('Qty')}</th><th>{t('Part')}</th><th>{t('Notes')}</th></tr></thead><tbody
                >{#each calculated.design.bom() as item}<tr
                    ><td>{item.qty}</td><td>{item.item}</td><td class="opacity-60">{item.note}</td></tr
                  >{/each}</tbody
              >
            </table>
          </div>
          <pre class="mt-4 text-xs whitespace-pre-wrap opacity-60">{calculated.design.summary()}</pre>
        </details>{/if}
    </main>
  </div>
</div>
{#if toast}<div class="toast toast-end"><div class="alert alert-info">{toast}</div></div>{/if}
