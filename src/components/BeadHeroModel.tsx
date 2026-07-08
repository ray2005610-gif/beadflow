import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

export function BeadHeroModel() {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let frame = 0;
    let disposed = false;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
    camera.position.set(0, 0.55, 3.25);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    host.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0xfff7eb, 0xd2b391, 2.8));
    const keyLight = new THREE.DirectionalLight(0xfff2df, 3.1);
    keyLight.position.set(2.8, 3.2, 4);
    scene.add(keyLight);
    const fillLight = new THREE.DirectionalLight(0xcaa381, 1.2);
    fillLight.position.set(-3, 1, 2);
    scene.add(fillLight);

    const group = new THREE.Group();
    scene.add(group);

    const resize = () => {
      const width = host.clientWidth || 320;
      const height = host.clientHeight || 320;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };

    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath("/draco/");
    const loader = new GLTFLoader();
    loader.setDRACOLoader(dracoLoader);
    loader.load(
      "/models/bead.glb",
      (gltf) => {
        if (disposed) return;
        const model = gltf.scene;
        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        const maxSize = Math.max(size.x, size.y, size.z) || 1;
        model.position.sub(center);
        model.scale.setScalar(2.95 / maxSize);
        group.add(model);
        setLoaded(true);
      },
      undefined,
      (error) => {
        console.error("GLB model failed to load: /models/bead.glb", error);
        setFailed(true);
      }
    );

    const animate = () => {
      frame = window.requestAnimationFrame(animate);
      const time = performance.now() * 0.001;
      group.rotation.y = time * 0.45;
      group.rotation.x = Math.sin(time * 0.7) * 0.08;
      group.position.y = Math.sin(time * 1.25) * 0.08;
      renderer.render(scene, camera);
    };

    resize();
    animate();
    window.addEventListener("resize", resize);

    return () => {
      disposed = true;
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
      renderer.dispose();
      dracoLoader.dispose();
      host.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <div className="bf-model-card" aria-label="3D 拼豆展示">
      <div ref={hostRef} className="bf-model-stage" />
      {!loaded && !failed && <div className="bf-model-fallback">3D 模型載入中</div>}
      {failed && <div className="bf-model-fallback">3D 模型暫時無法顯示</div>}
    </div>
  );
}
