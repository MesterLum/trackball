<script lang="ts">
  import { onMount } from 'svelte';
  import * as THREE from 'three';
  import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
  import { STLLoader } from 'three/addons/loaders/STLLoader.js';
  import type { RenderedPart } from '@trackball/renderer-browser';
  let {
    parts,
    tilt = 0,
    tent = 0,
    ballRadius = 17,
    floor = -40,
    explode = 0,
    visible,
    showBall = true,
    showGrid = true,
    dark = false,
    onframe = () => {},
    fill = false,
  }: {
    parts: RenderedPart[];
    tilt?: number;
    tent?: number;
    ballRadius?: number;
    floor?: number;
    explode?: number;
    visible: Record<string, boolean>;
    showBall?: boolean;
    showGrid?: boolean;
    dark?: boolean;
    /** Called after new meshes are loaded and framed. */
    onframe?: () => void;
    /** Take the whole window (thumbnail rendering). */
    fill?: boolean;
  } = $props();
  let host: HTMLDivElement;
  let scene: THREE.Scene,
    renderer: THREE.WebGLRenderer,
    camera: THREE.PerspectiveCamera,
    controls: OrbitControls,
    ball: THREE.Mesh,
    grid: THREE.GridHelper;
  // Three.js caches, not UI state: plain Maps on purpose.
  // eslint-disable-next-line svelte/prefer-svelte-reactivity
  const meshes = new Map<string, THREE.Mesh>();
  // eslint-disable-next-line svelte/prefer-svelte-reactivity
  const loaded = new Map<string, Uint8Array>();
  let ready = $state(false),
    error = $state('');
  export function fit() {
    if (!scene || !camera) return;
    const box = new THREE.Box3();
    for (const mesh of meshes.values()) if (mesh.visible) box.expandByObject(mesh);
    if (box.isEmpty()) box.setFromObject(ball);
    // Fit the bounding sphere into the narrower of the two fields of view (portrait screens).
    const sphere = box.getBoundingSphere(new THREE.Sphere()),
      vertical = THREE.MathUtils.degToRad(camera.fov),
      horizontal = 2 * Math.atan(Math.tan(vertical / 2) * camera.aspect),
      distance = (sphere.radius / Math.sin(Math.min(vertical, horizontal) / 2)) * 0.95;
    camera.position
      .copy(sphere.center)
      .add(new THREE.Vector3(1, -1, 0.9).normalize().multiplyScalar(distance));
    const center = sphere.center;
    controls.target.copy(center);
    controls.update();
  }
  export function snapshot() {
    if (!renderer) return;
    renderer.render(scene, camera);
    const a = document.createElement('a');
    a.href = renderer.domElement.toDataURL('image/png');
    a.download = 'trackball.png';
    a.click();
  }
  onMount(() => {
    let animation = 0,
      observer: ResizeObserver;
    try {
      scene = new THREE.Scene();
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
      renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
      // eslint-disable-next-line svelte/no-dom-manipulating -- Three.js owns this canvas; Svelte renders nothing inside host
      host.append(renderer.domElement);
      camera = new THREE.PerspectiveCamera(38, 1, 0.1, 4000);
      camera.up.set(0, 0, 1);
      camera.position.set(140, -170, 140);
      controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      scene.add(new THREE.HemisphereLight(0xffffff, 0x445569, 2));
      const light = new THREE.DirectionalLight(0xffffff, 3);
      light.position.set(80, -100, 160);
      scene.add(light);
      ball = new THREE.Mesh(
        new THREE.SphereGeometry(1, 48, 32),
        // Mostly opaque; a little translucency still hints at the supports below.
        new THREE.MeshPhysicalMaterial({
          color: 0xc81e3c,
          transparent: true,
          opacity: 0.82,
          roughness: 0.25,
          clearcoat: 0.6,
        }),
      );
      scene.add(ball);
      observer = new ResizeObserver(() => {
        const w = host.clientWidth,
          h = host.clientHeight;
        renderer.setSize(w, h);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      });
      observer.observe(host);
      const loop = () => {
        animation = requestAnimationFrame(loop);
        controls.update();
        renderer.render(scene, camera);
      };
      loop();
      ready = true;
    } catch (e) {
      error = `3D preview unavailable: ${String(e)}`;
    }
    return () => {
      ready = false;
      cancelAnimationFrame(animation);
      observer?.disconnect();
      controls?.dispose();
      for (const m of meshes.values()) {
        m.geometry.dispose();
        (m.material as THREE.Material).dispose();
      }
      ball?.geometry.dispose();
      (ball?.material as THREE.Material)?.dispose();
      grid?.geometry.dispose();
      renderer?.dispose();
    };
  });
  // 10 mm cells, coloured to sit quietly on the current theme.
  $effect(() => {
    if (!ready) return;
    const [major, minor] = dark ? [0x48535a, 0x2b3236] : [0xbfc4bd, 0xe0e3de];
    const next = new THREE.GridHelper(300, 30, major, minor);
    next.rotation.x = Math.PI / 2;
    if (grid) {
      next.position.z = grid.position.z;
      next.visible = grid.visible;
      scene.remove(grid);
      grid.geometry.dispose();
      (grid.material as THREE.Material).dispose();
    }
    grid = next;
    scene.add(grid);
  });
  $effect(() => {
    if (!ready) return;
    const wanted = new Set(parts.map((p) => p.name));
    for (const [name, mesh] of meshes)
      if (!wanted.has(name as RenderedPart['name'])) {
        scene.remove(mesh);
        mesh.geometry.dispose();
        (mesh.material as THREE.Material).dispose();
        meshes.delete(name);
        loaded.delete(name);
      }
    let changed = false;
    for (const part of parts) {
      if (loaded.get(part.name) !== part.bytes) {
        const old = meshes.get(part.name);
        if (old) {
          scene.remove(old);
          old.geometry.dispose();
          (old.material as THREE.Material).dispose();
        }
        const buffer = part.bytes.buffer.slice(
          part.bytes.byteOffset,
          part.bytes.byteOffset + part.bytes.byteLength,
        ) as ArrayBuffer;
        const geometry = new STLLoader().parse(buffer);
        geometry.computeVertexNormals();
        const mesh = new THREE.Mesh(
          geometry,
          new THREE.MeshStandardMaterial({ color: part.color, metalness: 0.05, roughness: 0.65 }),
        );
        meshes.set(part.name, mesh);
        loaded.set(part.name, part.bytes);
        scene.add(mesh);
        changed = true;
      }
      const mesh = meshes.get(part.name)!;
      mesh.rotation.set(0, 0, 0);
      if (part.frame === 'deck') {
        mesh.rotation.order = 'YXZ';
        mesh.rotation.x = THREE.MathUtils.degToRad(tilt);
        mesh.rotation.y = THREE.MathUtils.degToRad(tent);
      }
      mesh.position.z = part.lift * explode;
      mesh.visible = visible[part.name] ?? visible.hardware ?? false;
    }
    ball.scale.setScalar(ballRadius);
    // One step above the cup (lift 2) so exploding separates the ball from it.
    ball.position.z = explode * 3;
    ball.visible = showBall;
    grid.position.z = floor - 0.1;
    grid.visible = showGrid;
    if (changed) {
      fit();
      onframe();
    }
  });
</script>

<div class="viewer" class:fill bind:this={host} aria-label="3D model preview">
  {#if error}<p role="alert" class="alert alert-warning absolute inset-x-4 top-4">{error}</p>{/if}
</div>

<style>
  .viewer {
    height: clamp(320px, 58vh, 760px);
    width: 100%;
    position: relative;
    background: var(--color-base-100);
  }
  .viewer.fill {
    height: 100vh;
    background: transparent;
  }
  .viewer :global(canvas) {
    display: block;
    touch-action: none;
  }
</style>
