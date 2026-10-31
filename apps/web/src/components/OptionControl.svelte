<script lang="ts">
  import { TRANSLATED_CHOICES } from '@trackball/core';
  import type { Option } from '@trackball/core';
  let {
    option,
    value = $bindable(),
    onchange,
    t = (s: string) => s,
  // The same value binds to a checkbox, select, number or text field depending on option.kind.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }: { option: Option; value: any; onchange: () => void; t?: (s: string) => string } = $props();
  const changed = () => queueMicrotask(onchange);
  let title = $derived(t(option.label || option.name.replaceAll('_', ' ')));
</script>

<div class="option-row">
  {#if option.kind === 'bool'}
    <label class="flex items-center justify-between gap-4"
      ><span class="option-label">{title}</span><input
        class="toggle toggle-sm toggle-primary"
        type="checkbox"
        bind:checked={value}
        onchange={changed}
      /></label
    >
  {:else}
    <label class="option-label mb-2" for={'option-' + option.name}>{title}</label>
    {#if option.kind === 'choice'}
      <select
        id={'option-' + option.name}
        class="select select-sm w-full"
        bind:value
        onchange={changed}
        >{#each option.choices as choice (choice)}<option value={choice}
            >{TRANSLATED_CHOICES.has(option.name) ? t(option.choice_labels?.[choice] ?? choice) : choice}</option
          >{/each}</select
      >
    {:else if option.kind === 'float' || option.kind === 'int'}
      <div class="flex items-center gap-3">
        <input
          aria-label={title + ' slider'}
          class="range range-xs range-primary flex-1"
          type="range"
          min={option.min ?? undefined}
          max={option.max ?? undefined}
          step={option.step || 1}
          bind:value
          oninput={changed}
        /><label class="input input-sm w-24 shrink-0 pr-2"
          ><input
            id={'option-' + option.name}
            type="number"
            min={option.min ?? undefined}
            max={option.max ?? undefined}
            step={option.step || 1}
            bind:value
            oninput={changed}
          />{#if option.unit}<span class="muted text-xs" aria-hidden="true">{option.unit}</span>{/if}</label
        >
      </div>
    {:else}
      <input
        id={'option-' + option.name}
        class="input input-sm w-full"
        type="text"
        bind:value
        oninput={changed}
        placeholder="50x34x5"
      />
    {/if}
  {/if}
  <p class="muted text-xs mt-2 leading-relaxed">{t(option.help)}</p>
</div>

<style>
  .option-row {
    padding: 0.9rem 0;
    border-bottom: 1px solid var(--line);
  }
  .option-row:last-child {
    border-bottom: 0;
  }
  .option-label {
    display: inline-block;
    font-size: 0.875rem;
    font-weight: 550;
  }
  .option-label::first-letter {
    text-transform: uppercase;
  }
</style>
