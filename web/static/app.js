// Alpine.js application state for the configurator.
// Flow: edit -> debounce -> POST /api/design (instant validation) -> if it fits,
// POST render -> follow SSE -> swap STLs into the viewer as they finish.
document.addEventListener('alpine:init', () => {
  Alpine.data('configurator', (boot) => ({
    groups: boot.options.groups,
    presets: boot.presets,
    options: {},            // name -> option spec
    cfg: {},                // current values
    errors: {},             // name -> message (422)
    tab: boot.options.groups[0].key,
    design: null,           // last DesignResponse
    parts: [],              // PartStatus[]
    rendering: false,
    explode: 0,
    visible: { cup: true, carrier: true, tray: true, palmrest: true, ball: true },
    toast: '',
    toastAction: null,      // {label, run} shown as a button in the toast
    _past: [], _future: [], _committed: '',   // undo / redo stacks of cfg snapshots (JSON)
    theme: localStorage.getItem('theme') || 'night',
    auto: boot.settings.auto_render,       // render previews as you edit
    autofit: true,                         // let the server raise padding when something does not fit
    settings: boot.settings,
    i18n: boot.i18n || {},                 // English -> current language, for strings built in JS
    finalizing: null,                      // {done, total} while the full-quality STLs render
    _abort: null, _es: null, _timer: null, _renderId: null,

    // ---------------------------------------------------------------- lifecycle
    init() {
      for (const g of this.groups) for (const o of g.options) this.options[o.name] = o;
      document.documentElement.dataset.theme = this.theme;
      this.cfg = this.fromURL();
      this._committed = JSON.stringify(this.cfg);
      this.update(true);
      this.$watch('explode', (v) => viewer.setExplode(v));
      addEventListener('popstate', () => { this.cfg = this.fromURL(); this.update(true); });
      addEventListener('keydown', (e) => this.onKey(e));
    },
    get fits() { return this.design && this.design.fits; },
    get problems() { return this.design ? this.design.problems : []; },
    get allDone() { return this.parts.length > 0 && this.parts.every((p) => p.state === 'done'); },
    get activePreset() {
      const p = this.presets.find((p) => Object.entries(this.defaultsWith(p.values)).every(([k, v]) => String(this.cfg[k]) === String(v)));
      return p ? p.key : null;
    },
    get stlUrl() { return this.design ? `/api/design/${this.design.id}/stl.zip` : '#'; },
    get scadUrl() { return this.design ? `/api/design/${this.design.id}/scad.zip` : '#'; },

    // ---------------------------------------------------------------- values
    defaults() { const c = {}; for (const o of Object.values(this.options)) c[o.name] = o.default; return c; },
    defaultsWith(values) { return { ...this.defaults(), ...values }; },
    isDefault(name) { return String(this.cfg[name]) === String(this.options[name].default); },
    fromURL() {
      const q = new URLSearchParams(location.search);
      const preset = q.get('preset');
      const base = preset && this.presets.find((p) => p.key === preset) ? this.defaultsWith(this.presets.find((p) => p.key === preset).values) : this.defaults();
      for (const [k, v] of q.entries()) if (k in this.options) base[k] = this.options[k].kind === 'bool' ? v === '1' || v === 'true' : v;
      return base;
    },
    toURL(push = false) {
      const q = new URLSearchParams();
      for (const o of Object.values(this.options)) {
        const v = this.cfg[o.name];
        if (v === '' || v == null || String(v) === String(o.default)) continue;
        q.set(o.name, o.kind === 'bool' ? '1' : v);
      }
      const url = location.pathname + (q.toString() ? '?' + q : '');
      if (url !== location.pathname + location.search) (push ? history.pushState : history.replaceState).call(history, null, '', url);
    },
    loadPreset(p) { this.cfg = this.defaultsWith(p.values); this.update(); this.say(this.t('Loaded "{title}"', { title: p.title })); },
    reset() { this.cfg = this.defaults(); this.update(); },
    nudge(name, dir) {
      const o = this.options[name]; const step = o.step || 1;
      let v = Number(this.cfg[name]) + dir * step;
      if (o.min != null) v = Math.max(o.min, v); if (o.max != null) v = Math.min(o.max, v);
      this.cfg[name] = Math.round(v * 1000) / 1000; this.update();
    },

    // ---------------------------------------------------------------- server
    update(immediate = false) {
      clearTimeout(this._timer);
      this._timer = setTimeout(() => this.send(), immediate ? 0 : 350);
    },
    /** record the state about to be sent as one undo step (slider bursts collapse into one) */
    commit() {
      const now = JSON.stringify(this.cfg);
      if (now === this._committed) return false;
      this._past.push(this._committed); if (this._past.length > 100) this._past.shift();
      this._future = [];
      this._committed = now;
      return true;
    },
    get canUndo() { return this._past.length > 0; },
    get canRedo() { return this._future.length > 0; },
    undo() {
      if (!this.canUndo) return;
      this._future.push(this._committed);
      this._committed = this._past.pop();
      this.cfg = JSON.parse(this._committed);
      this.update(true);
    },
    redo() {
      if (!this.canRedo) return;
      this._past.push(this._committed);
      this._committed = this._future.pop();
      this.cfg = JSON.parse(this._committed);
      this.update(true);
    },
    /** undo the server's auto-fit: restore the values you typed and stop auto-fit from redoing it */
    undoAutofit() {
      this.autofit = false;
      this.undo();
      this.say(this.t('Auto-fit undone and switched off'));
    },
    onKey(e) {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      const tag = (e.target && e.target.tagName) || '';
      if ((tag === 'INPUT' && !['range', 'checkbox'].includes(e.target.type)) || tag === 'TEXTAREA' || tag === 'SELECT') return;
      const k = e.key.toLowerCase();
      if (k === 'z' && !e.shiftKey) { e.preventDefault(); this.undo(); }
      else if ((k === 'z' && e.shiftKey) || k === 'y') { e.preventDefault(); this.redo(); }
    },
    async send() {
      const stepped = this.commit();
      this.toURL(stepped);
      if (this._abort) this._abort.abort();
      const ac = new AbortController(); this._abort = ac;
      let r;
      try {
        r = await fetch(`/api/design?quality=preview&autofit=${this.autofit}`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(this.cfg), signal: ac.signal });
      } catch (e) { if (e.name === 'AbortError') return; this.say(this.t('Server unreachable')); return; }
      if (ac !== this._abort) return;
      if (r.status === 422) { const b = await r.json(); this.errors = b.fields || {}; return; }
      if (!r.ok) { this.say(this.t('Server error {status}', { status: r.status })); return; }
      this.errors = {};
      const d = await r.json();
      this.design = d;
      if (d.adjusted && d.adjusted.length) {          // reflect the auto-fit in the form, as its own undo step
        for (const c of d.adjusted) this.cfg[c.option] = c.to;
        this.commit();
        this.toURL();
        this.say(d.adjusted.map((c) => `${c.option} ${c.from} → ${c.to}`).join(', '), { label: this.t('Undo'), run: () => this.undoAutofit() });
      }
      viewer.setFrame({ tilt: d.tilt, tent: d.tent, ball_r: d.ball_r, floor_z: d.floor_z });
      if (d.fits && this.auto) this.render(d.id); else { this.stopEvents(); this.rendering = false; }
    },
    renderNow() { if (this.design && this.design.fits) this.render(this.design.id); },
    async render(id) {
      this.stopEvents();
      this.rendering = true;
      const prev = this._renderId && this._renderId !== id ? `?supersedes=${this._renderId}` : '';
      this._renderId = id;
      const st = await (await fetch(`/api/design/${id}/render${prev}`, { method: 'POST' })).json();
      if (!this.design || this.design.id !== id) return;
      const names = st.parts.map((p) => p.name);
      viewer.clear(names); viewer.markStale(names);
      const loaded = new Set();
      const apply = (s) => {
        this.parts = s.parts;
        for (const p of s.parts) if (p.state === 'done' && !loaded.has(p.name)) {
          loaded.add(p.name); viewer.load(p.name, p.url + '?v=' + id, p.color, p.frame, p.lift);
        }
        if (s.done) { this.rendering = false; this.stopEvents(); }
      };
      apply(st);
      if (st.done) return;
      this._es = new EventSource(`/api/design/${id}/events`);
      this._es.onmessage = (e) => { if (this.design && this.design.id === id) apply(JSON.parse(e.data)); };
      this._es.onerror = () => { this.stopEvents(); this.rendering = false; };
    },
    stopEvents() { if (this._es) { this._es.close(); this._es = null; } },
    /** full-quality STLs: a separate design id (final $fn), rendered on request, then downloaded */
    async downloadFinal() {
      if (!this.design || !this.design.fits || this.finalizing) return;
      const r = await fetch('/api/design?quality=final', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(this.cfg) });
      if (!r.ok) { this.say(this.t('Could not prepare the final design')); return; }
      const d = await r.json();
      let st = await (await fetch(`/api/design/${d.id}/render`, { method: 'POST' })).json();
      const total = st.parts.length;
      const tick = (s) => { this.finalizing = { done: s.parts.filter((p) => p.state === 'done').length, total }; };
      tick(st);
      if (!st.done) {
        await new Promise((resolve) => {
          const es = new EventSource(`/api/design/${d.id}/events`);
          es.onmessage = (e) => { st = JSON.parse(e.data); tick(st); };
          es.addEventListener('end', () => { es.close(); resolve(); });
          es.onerror = () => { es.close(); resolve(); };
        });
      }
      this.finalizing = null;
      if (!st.ok) { this.say(this.t('Final render failed')); return; }
      location.href = `/api/design/${d.id}/stl.zip`;
    },

    // ---------------------------------------------------------------- ui helpers
    toggle(name) { this.visible[name] = !this.visible[name]; viewer.setVisible(name, this.visible[name]); },
    setTheme(t) { this.theme = t; localStorage.setItem('theme', t); document.documentElement.dataset.theme = t; },
    copy(text, msg) { navigator.clipboard.writeText(text); this.say(msg); },
    share() { this.copy(location.href, this.t('Link copied')); },
    say(msg, action = null) {
      this.toast = msg; this.toastAction = action;
      clearTimeout(this._toast); this._toast = setTimeout(() => { this.toast = ''; this.toastAction = null; }, action ? 6000 : 1800);
    },
    stateClass(s) { return { queued: 'badge-ghost', rendering: 'badge-warning', done: 'badge-success', error: 'badge-error' }[s] || ''; },
    /** translate a UI string; {name} placeholders are filled from vars */
    t(s, vars) { let out = this.i18n[s] || s; for (const k in (vars || {})) out = out.split('{' + k + '}').join(vars[k]); return out; },
    setLang(l) { const u = new URL(location.href); u.searchParams.set('lang', l); location.href = u.toString(); },
    fmt(v, o) { return (o.kind === 'float' || o.kind === 'int') ? `${Number(v)}${o.unit ? ' ' + o.unit : ''}` : v; },
  }));
});
