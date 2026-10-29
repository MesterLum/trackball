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
    tab: boot.options.groups[0].name,
    design: null,           // last DesignResponse
    parts: [],              // PartStatus[]
    rendering: false,
    explode: 0,
    visible: { cup: true, carrier: true, tray: true, palmrest: true, ball: true },
    toast: '',
    theme: localStorage.getItem('theme') || 'night',
    _abort: null, _es: null, _timer: null,

    // ---------------------------------------------------------------- lifecycle
    init() {
      for (const g of this.groups) for (const o of g.options) this.options[o.name] = o;
      document.documentElement.dataset.theme = this.theme;
      this.cfg = this.fromURL();
      this.update(true);
      this.$watch('explode', (v) => viewer.setExplode(v));
      addEventListener('popstate', () => { this.cfg = this.fromURL(); this.update(true); });
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
    toURL() {
      const q = new URLSearchParams();
      for (const o of Object.values(this.options)) {
        const v = this.cfg[o.name];
        if (v === '' || v == null || String(v) === String(o.default)) continue;
        q.set(o.name, o.kind === 'bool' ? '1' : v);
      }
      const url = location.pathname + (q.toString() ? '?' + q : '');
      if (url !== location.pathname + location.search) history.replaceState(null, '', url);
    },
    loadPreset(p) { this.cfg = this.defaultsWith(p.values); this.update(); this.say(`Loaded "${p.title}"`); },
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
    async send() {
      this.toURL();
      if (this._abort) this._abort.abort();
      const ac = new AbortController(); this._abort = ac;
      let r;
      try {
        r = await fetch('/api/design', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(this.cfg), signal: ac.signal });
      } catch (e) { if (e.name === 'AbortError') return; this.say('Server unreachable'); return; }
      if (ac !== this._abort) return;
      if (r.status === 422) { const b = await r.json(); this.errors = b.fields || {}; return; }
      if (!r.ok) { this.say('Server error ' + r.status); return; }
      this.errors = {};
      const d = await r.json();
      this.design = d;
      viewer.setFrame({ tilt: d.tilt, tent: d.tent, ball_r: d.ball_r, floor_z: d.floor_z });
      if (d.fits) this.render(d.id); else { this.stopEvents(); this.rendering = false; }
    },
    async render(id) {
      this.stopEvents();
      this.rendering = true;
      const st = await (await fetch(`/api/design/${id}/render`, { method: 'POST' })).json();
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

    // ---------------------------------------------------------------- ui helpers
    toggle(name) { this.visible[name] = !this.visible[name]; viewer.setVisible(name, this.visible[name]); },
    setTheme(t) { this.theme = t; localStorage.setItem('theme', t); document.documentElement.dataset.theme = t; },
    copy(text, msg) { navigator.clipboard.writeText(text); this.say(msg); },
    share() { this.copy(location.href, 'Link copied'); },
    say(msg) { this.toast = msg; clearTimeout(this._toast); this._toast = setTimeout(() => (this.toast = ''), 1800); },
    stateClass(s) { return { queued: 'badge-ghost', rendering: 'badge-warning', done: 'badge-success', error: 'badge-error' }[s] || ''; },
    fmt(v, o) { return (o.kind === 'float' || o.kind === 'int') ? `${Number(v)}${o.unit ? ' ' + o.unit : ''}` : v; },
  }));
});
