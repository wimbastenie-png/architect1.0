/**
 * 3D-weergave (three.js): muren met ramen en deuren, vloeren in hun
 * materiaal, meubels. Draaien/zoomen met muis of vingers. Beeld bewaren als
 * PNG en het model als GLB (voor fotorealistisch renderen in Blender,
 * Twinmotion, Enscape …). Apart geladen: three.js zit niet in de hoofdbundel.
 */
import { model3D, type Project } from "@scanapp/core";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";

export default function Drie3D({ project, verdiepingId, sluit }: { project: Project; verdiepingId?: string; sluit: () => void }) {
  const houder = useRef<HTMLDivElement>(null);
  const [toestand, zetToestand] = useState<"nieuw" | "bestaand">("nieuw");
  const [alle, zetAlle] = useState(false);
  const [fout, zetFout] = useState<string | null>(null);
  const api = useRef<{ png: () => void; glb: () => void; zicht: (s: "vogel" | "binnen") => void } | null>(null);

  useEffect(() => {
    const el = houder.current;
    if (!el) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    } catch {
      zetFout("Dit toestel of deze browser kan geen 3D tonen (WebGL ontbreekt).");
      return;
    }
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    el.appendChild(renderer.domElement);
    renderer.domElement.setAttribute("aria-label", "3D-weergave");

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#e8eef3");
    const m = model3D(project, { verdiepingId: alle ? undefined : verdiepingId, toestand });
    const s = 1 / 1000; // mm → m
    const groep = new THREE.Group();
    groep.name = project.naam;
    const materialen = new Map<string, THREE.Material>();
    const mat = (kleur: string, doorzichtig?: boolean) => {
      const k = `${kleur}${doorzichtig ? "t" : ""}`;
      if (!materialen.has(k)) materialen.set(k, new THREE.MeshStandardMaterial({ color: kleur, roughness: doorzichtig ? 0.1 : 0.85, metalness: 0, transparent: !!doorzichtig, opacity: doorzichtig ? 0.35 : 1 }));
      return materialen.get(k)!;
    };
    for (const p of m.prismas) {
      const vorm = new THREE.Shape(p.punten.map((q) => new THREE.Vector2((q.x - m.midden.x) * s, (q.y - m.midden.y) * s)));
      const geo = new THREE.ExtrudeGeometry(vorm, { depth: Math.max(0.001, (p.z1 - p.z0) * s), bevelEnabled: false });
      geo.translate(0, 0, p.z0 * s);
      geo.rotateX(-Math.PI / 2); // plan-y → −z, extrusie → omhoog
      const mesh = new THREE.Mesh(geo, mat(p.kleur, p.doorzichtig));
      mesh.name = p.naam ?? p.soort;
      mesh.castShadow = p.soort !== "glas";
      mesh.receiveShadow = true;
      groep.add(mesh);
    }
    for (const vl of m.vlakken) {
      const pts = vl.punten.map((q) => new THREE.Vector3((q.x - m.midden.x) * s, q.z * s, -(q.y - m.midden.y) * s));
      const geo = new THREE.BufferGeometry();
      const pos: number[] = [];
      for (let k = 1; k + 1 < pts.length; k++) for (const q of [pts[0]!, pts[k]!, pts[k + 1]!]) pos.push(q.x, q.y, q.z);
      geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
      geo.computeVertexNormals();
      const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: vl.kleur, roughness: 0.9, side: THREE.DoubleSide }));
      mesh.name = vl.naam;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      groep.add(mesh);
    }
    scene.add(groep);
    const grond = new THREE.Mesh(new THREE.CircleGeometry(m.grootte * s * 3, 48), new THREE.MeshStandardMaterial({ color: "#cbd5c0", roughness: 1 }));
    grond.rotation.x = -Math.PI / 2;
    grond.position.y = -0.035;
    grond.receiveShadow = true;
    scene.add(grond);

    scene.add(new THREE.HemisphereLight("#ffffff", "#8a7f6f", 1.1));
    const zon = new THREE.DirectionalLight("#fff4e0", 2.2);
    const R = Math.max(5, m.grootte * s);
    zon.position.set(R * 0.6, R * 1.2, R * 0.8);
    zon.castShadow = true;
    zon.shadow.mapSize.set(2048, 2048);
    Object.assign(zon.shadow.camera, { left: -R, right: R, top: R, bottom: -R, near: 0.1, far: R * 4 });
    scene.add(zon);

    const camera = new THREE.PerspectiveCamera(50, 1, 0.05, 500);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.maxPolarAngle = Math.PI * 0.495;
    const zicht = (soort: "vogel" | "binnen") => {
      if (soort === "vogel") { camera.position.set(R * 0.9, R * 1.1, R * 1.1); controls.target.set(0, 1, 0); }
      else { camera.position.set(-R * 0.25, 1.6, R * 0.25); controls.target.set(R * 0.2, 1.3, -R * 0.1); }
      controls.update();
    };
    zicht("vogel");

    const maat = () => {
      const b = el.clientWidth || 320, h = el.clientHeight || 240;
      renderer.setSize(b, h, false);
      renderer.domElement.style.width = "100%";
      renderer.domElement.style.height = "100%";
      camera.aspect = b / h;
      camera.updateProjectionMatrix();
    };
    maat();
    const ro = new ResizeObserver(maat);
    ro.observe(el);
    let loopt = true;
    const lus = () => { if (!loopt) return; controls.update(); renderer.render(scene, camera); requestAnimationFrame(lus); };
    lus();

    const naam = project.naam.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "project";
    const bewaar = (blob: Blob, bestand: string) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = bestand; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    };
    api.current = {
      zicht,
      png: () => { renderer.render(scene, camera); renderer.domElement.toBlob((b) => b && bewaar(b, `${naam}-3d.png`), "image/png"); },
      glb: () => {
        new GLTFExporter().parse(groep, (res) => bewaar(new Blob([res as ArrayBuffer], { type: "model/gltf-binary" }), `${naam}.glb`), (e) => zetFout(`3D-bestand maken lukt niet: ${String(e)}`), { binary: true });
      },
    };
    return () => {
      loopt = false;
      ro.disconnect();
      controls.dispose();
      groep.traverse((o) => { if (o instanceof THREE.Mesh) o.geometry.dispose(); });
      materialen.forEach((x) => x.dispose());
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [project, verdiepingId, toestand, alle]);

  return (
    <div className="dialoog-achtergrond drie3d-achtergrond" role="presentation">
      <section className="kaart dialoog drie3d" role="dialog" aria-modal="true" aria-label="3D-weergave">
        <div className="kaart-kop"><h2>3D</h2><button onClick={sluit} aria-label="Sluiten">×</button></div>
        <div className="soorten">
          <button className={toestand === "nieuw" ? "actief" : ""} onClick={() => zetToestand("nieuw")}>Nieuwe toestand</button>
          <button className={toestand === "bestaand" ? "actief" : ""} onClick={() => zetToestand("bestaand")}>Bestaand</button>
          <button className={alle ? "actief" : ""} aria-pressed={alle} onClick={() => zetAlle(!alle)}>Alle verdiepingen</button>
          <button onClick={() => api.current?.zicht("vogel")}>Vogelvlucht</button>
          <button onClick={() => api.current?.zicht("binnen")}>Binnen</button>
        </div>
        {fout ? <p className="melding" role="alert">{fout}</p> : <div className="drie3d-beeld" ref={houder} />}
        <p className="uitleg">Slepen = draaien, knijpen of muiswiel = zoomen, twee vingers of rechtermuisknop = verschuiven. Schetsbeeld: voor een fotorealistisch beeld bewaar je het 3D-bestand (GLB) en render je het in bv. Blender, Twinmotion of Enscape.</p>
        <div className="acties">
          <button className="primair" onClick={() => api.current?.png()}>Beeld bewaren (PNG)</button>
          <button onClick={() => api.current?.glb()}>3D-bestand (GLB)</button>
        </div>
      </section>
    </div>
  );
}
