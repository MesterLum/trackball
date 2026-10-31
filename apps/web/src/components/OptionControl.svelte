<script lang="ts">
  import type { Option } from '@trackball/core';
  let {
    option,
    value = $bindable(),
    onchange,
    t = (s: string) => s,
  }: { option: Option; value: any; onchange: () => void; t?: (s: string) => string } = $props();
  const changed = () => queueMicrotask(onchange);
  let title = $derived(t(option.label || option.name.replaceAll('_', ' ')));
</script>

<div class="option-row">
  {#if option.kind === 'bool'}
    <label class="flex items-center justify-between gap-4"
      ><span class="font-medium">{title}</span><input
        class="toggle toggle-sm toggle-primary"
        type="checkbox"
        bind:checked={value}
        onchange={changed}
      /></label
    >
  {:else}
    <label class="font-medium block mb-2" for={'option-' + option.name}
      >{title}{#if option.unit}<span aria-hidden="true" class="float-right opacity-60 text-xs"
          >{option.unit}</span
        >{/if}</label
    >
    {#if option.kind === 'choice'}
      <select
        id={'option-' + option.name}
        class="select select-bordered select-sm w-full"
        bind:value
        onchange={changed}
        >{#each option.choices as choice}<option value={choice}
            >{option.name === 'palm_attachment' ? t(choice) : choice}</option
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
        /><input
          id={'option-' + option.name}
          class="input input-bordered input-sm w-24 font-mono"
          type="number"
          min={option.min ?? undefined}
          max={option.max ?? undefined}
          step={option.step || 1}
          bind:value
          oninput={changed}
        />
      </div>
    {:else}
      <input
        id={'option-' + option.name}
        class="input input-bordered input-sm w-full"
        type="text"
        bind:value
        oninput={changed}
        placeholder="50x34x5"
      />
    {/if}
  {/if}
  <p class="text-xs opacity-60 mt-2 leading-relaxed">{t(option.help)}</p>
</div>

<style>
  .option-row {
    padding: 1rem 0;
    border-bottom: 1px solid color-mix(in srgb, currentColor 9%, transparent);
  }
</style>
