import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useScroll } from 'framer-motion';

/**
 * CosmicSingularity — A luxury, award-winning WebGL Black Hole & Quantum Photon Rain experience.
 * Features:
 * 1. "Interstellar" Gravitational Singularity with glowing, tilted Accretion Disk & Lensing Halo.
 * 2. Quantum Photon Rain: 1,500 streaming cosmic light filaments raining from top to bottom.
 * 3. Gravitational Cursor Physics: Photon streams warp and bend around mouse movement.
 * 4. Scroll-Driven Warp Dive: Speed and perspective adjust fluidly as the user scrolls.
 * 5. 100% Non-blocking (pointer-events: none, z-index: 0): Text & buttons stay 100% crisp.
 */
const CosmicSingularity = () => {
  const mountRef = useRef(null);
  const mouseRef = useRef({ x: 0, y: 0, targetX: 0, targetY: 0 });
  const scrollRef = useRef({ progress: 0, velocity: 0, lastScrollY: 0 });

  const { scrollYProgress } = useScroll();

  useEffect(() => {
    const unsubscribe = scrollYProgress.on('change', (v) => {
      const delta = v - scrollRef.current.lastScrollY;
      scrollRef.current.velocity = Math.min(Math.abs(delta) * 50, 4);
      scrollRef.current.lastScrollY = v;
      scrollRef.current.progress = v;
    });
    return () => unsubscribe();
  }, [scrollYProgress]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    let width = window.innerWidth;
    let height = window.innerHeight;

    // ── 1. Scene, Camera & Renderer ──────────────────────────────────────────
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(55, width / height, 0.1, 1000);
    camera.position.set(0, 0.8, 6.5);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    // ── 2. Black Hole Singularity Core & Accretion Halo ──────────────────────
    const blackHoleGroup = new THREE.Group();
    blackHoleGroup.position.set(0, 1.2, 0); // Upper hero center
    scene.add(blackHoleGroup);

    // Dark Singularity Sphere (The Event Horizon)
    const sphereGeo = new THREE.SphereGeometry(1.05, 48, 48);
    const sphereMat = new THREE.MeshBasicMaterial({ color: 0x010206 });
    const singularitySphere = new THREE.Mesh(sphereGeo, sphereMat);
    blackHoleGroup.add(singularitySphere);

    // Inner Radiant Photon Rim (The Bright Boundary of the Event Horizon)
    const rimGeo = new THREE.RingGeometry(1.06, 1.14, 64);
    const rimMat = new THREE.MeshBasicMaterial({
      color: 0x818cf8,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
    });
    const eventHorizonRim = new THREE.Mesh(rimGeo, rimMat);
    blackHoleGroup.add(eventHorizonRim);

    // Primary Accretion Disk (Horizontal Tilted Glowing Ring)
    const diskGeo = new THREE.RingGeometry(1.3, 3.8, 128);
    // Custom gradient vertex colors for the accretion disk
    const diskPos = diskGeo.attributes.position;
    const diskColors = new Float32Array(diskPos.count * 3);
    const colorInner = new THREE.Color(0xa855f7); // Neon Violet
    const colorMid = new THREE.Color(0x6366f1);   // Electric Indigo
    const colorOuter = new THREE.Color(0x06b6d4); // Cyan Blue

    for (let i = 0; i < diskPos.count; i++) {
      const vx = diskPos.getX(i);
      const vy = diskPos.getY(i);
      const dist = Math.sqrt(vx * vx + vy * vy);
      const t = (dist - 1.3) / (3.8 - 1.3);

      let c = new THREE.Color();
      if (t < 0.4) {
        c.lerpColors(colorInner, colorMid, t / 0.4);
      } else {
        c.lerpColors(colorMid, colorOuter, (t - 0.4) / 0.6);
      }
      diskColors[i * 3] = c.r;
      diskColors[i * 3 + 1] = c.g;
      diskColors[i * 3 + 2] = c.b;
    }
    diskGeo.setAttribute('color', new THREE.BufferAttribute(diskColors, 3));

    const diskMat = new THREE.MeshBasicMaterial({
      vertexColors: true,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
    });
    const accretionDisk = new THREE.Mesh(diskGeo, diskMat);
    accretionDisk.rotation.x = Math.PI / 2.35; // Tilted toward viewer
    blackHoleGroup.add(accretionDisk);

    // Relativistic Lensing Arc (The Iconic Upper Curved Ring of Interstellar)
    const haloGeo = new THREE.TorusGeometry(2.35, 0.04, 16, 128, Math.PI * 1.3);
    const haloMat = new THREE.MeshBasicMaterial({
      color: 0xc084fc,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending,
    });
    const upperHalo = new THREE.Mesh(haloGeo, haloMat);
    upperHalo.rotation.z = Math.PI * 0.85;
    blackHoleGroup.add(upperHalo);

    const lowerHalo = new THREE.Mesh(haloGeo, haloMat);
    lowerHalo.rotation.z = -Math.PI * 0.15;
    lowerHalo.rotation.x = Math.PI;
    blackHoleGroup.add(lowerHalo);

    // ── 3. Quantum Photon Rain (Vertical Cosmic Particle Streams) ────────────
    const streamCount = 1400;
    const streamGeo = new THREE.BufferGeometry();
    const streamPositions = new Float32Array(streamCount * 3);
    const streamVelocities = new Float32Array(streamCount);
    const streamColors = new Float32Array(streamCount * 3);

    const rainPalette = [
      new THREE.Color(0x818cf8), // Indigo
      new THREE.Color(0xa855f7), // Purple
      new THREE.Color(0x38bdf8), // Cyan
      new THREE.Color(0xf472b6), // Rose
      new THREE.Color(0xffffff), // Pure Starlight
    ];

    for (let i = 0; i < streamCount; i++) {
      // Spread wide across viewport
      streamPositions[i * 3] = (Math.random() - 0.5) * 22;     // X
      streamPositions[i * 3 + 1] = (Math.random() - 0.5) * 20; // Y
      streamPositions[i * 3 + 2] = (Math.random() - 0.5) * 12; // Z

      // Unique falling velocity
      streamVelocities[i] = 0.04 + Math.random() * 0.08;

      // Color variation
      const col = rainPalette[Math.floor(Math.random() * rainPalette.length)];
      streamColors[i * 3] = col.r;
      streamColors[i * 3 + 1] = col.g;
      streamColors[i * 3 + 2] = col.b;
    }

    streamGeo.setAttribute('position', new THREE.BufferAttribute(streamPositions, 3));
    streamGeo.setAttribute('color', new THREE.BufferAttribute(streamColors, 3));

    const streamMat = new THREE.PointsMaterial({
      size: 0.045,
      vertexColors: true,
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending,
    });
    const photonRain = new THREE.Points(streamGeo, streamMat);
    scene.add(photonRain);

    // ── 4. Floating Cosmic Dust Constellation ─────────────────────────────────
    const dustCount = 350;
    const dustGeo = new THREE.BufferGeometry();
    const dustPositions = new Float32Array(dustCount * 3);
    for (let i = 0; i < dustCount; i++) {
      dustPositions[i * 3] = (Math.random() - 0.5) * 28;
      dustPositions[i * 3 + 1] = (Math.random() - 0.5) * 26;
      dustPositions[i * 3 + 2] = (Math.random() - 0.5) * 15;
    }
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
    const dustMat = new THREE.PointsMaterial({
      color: 0x94a3b8,
      size: 0.025,
      transparent: true,
      opacity: 0.35,
    });
    const cosmicDust = new THREE.Points(dustGeo, dustMat);
    scene.add(cosmicDust);

    // ── 5. Mouse Parallax & Gravity Lensing Listener ──────────────────────────
    const handleMouseMove = (e) => {
      mouseRef.current.targetX = (e.clientX / width - 0.5) * 2.0;
      mouseRef.current.targetY = -(e.clientY / height - 0.5) * 2.0;
    };
    window.addEventListener('mousemove', handleMouseMove, { passive: true });

    const handleResize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };
    window.addEventListener('resize', handleResize);

    // ── 6. Master Render Loop with Visibility & Off-screen Gating ───────────
    let animationId;
    let isVisible = true;
    const clock = new THREE.Clock();

    // Pause WebGL rendering when canvas is scrolled off-screen
    const observer = new IntersectionObserver(
      ([entry]) => {
        isVisible = entry.isIntersecting;
      },
      { threshold: 0.05 }
    );
    observer.observe(container);

    // Pause rendering when browser tab is inactive
    const handleVisibilityChange = () => {
      if (document.hidden) {
        isVisible = false;
      } else {
        const rect = container.getBoundingClientRect();
        isVisible = rect.top < window.innerHeight && rect.bottom > 0;
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    const animate = () => {
      animationId = requestAnimationFrame(animate);
      if (!isVisible) return; // Completely halts particle physics & WebGL pipeline when not visible

      const delta = clock.getDelta();
      const time = clock.getElapsedTime();

      // Smooth mouse interpolation
      mouseRef.current.x += (mouseRef.current.targetX - mouseRef.current.x) * 0.04;
      mouseRef.current.y += (mouseRef.current.targetY - mouseRef.current.y) * 0.04;

      // Scroll decay velocity
      scrollRef.current.velocity *= 0.94;
      const totalSpeedFactor = 1.0 + scrollRef.current.velocity;

      // Rotate Accretion Disk & Black Hole Rings
      accretionDisk.rotation.z += 0.18 * delta;
      upperHalo.rotation.y += 0.12 * delta;
      lowerHalo.rotation.y -= 0.12 * delta;

      // Parallax Tilt on mouse
      blackHoleGroup.rotation.y = mouseRef.current.x * 0.25;
      blackHoleGroup.rotation.x = -mouseRef.current.y * 0.18;

      // Singularity float & position based on scroll progress
      // At top: upper center; as scroll advances, it sweeps gently upward and recedes into space
      const scrollP = scrollRef.current.progress;
      blackHoleGroup.position.y = 1.2 + scrollP * 3.5;
      blackHoleGroup.position.z = -scrollP * 4.0;
      blackHoleGroup.scale.setScalar(Math.max(0.4, 1.0 - scrollP * 0.45));

      // Animate Quantum Photon Rain (Streaming top to bottom)
      const positions = streamGeo.attributes.position.array;
      const mouseWorldX = mouseRef.current.x * 6;
      const mouseWorldY = mouseRef.current.y * 4;

      for (let i = 0; i < streamCount; i++) {
        const idx = i * 3;

        // Fall downward
        positions[idx + 1] -= streamVelocities[i] * totalSpeedFactor * (1.0 + delta * 20);

        // Gravitational Lensing around cursor: gently pull towards mouse X/Y
        const dx = mouseWorldX - positions[idx];
        const dy = mouseWorldY - positions[idx + 1];
        const distSq = dx * dx + dy * dy;

        if (distSq < 16 && distSq > 0.2) {
          const force = 0.012 / distSq;
          positions[idx] += dx * force;
          positions[idx + 2] += (Math.random() - 0.5) * 0.01;
        }

        // Reset to top when it falls past bottom boundary
        if (positions[idx + 1] < -10) {
          positions[idx + 1] = 10;
          positions[idx] = (Math.random() - 0.5) * 22;
        }
      }
      streamGeo.attributes.position.needsUpdate = true;

      // Cosmic dust slow drift
      cosmicDust.rotation.y += 0.02 * delta;
      cosmicDust.rotation.x -= 0.01 * delta;

      renderer.render(scene, camera);
    };

    animate();

    // ── Cleanup ──────────────────────────────────────────────────────────────
    return () => {
      cancelAnimationFrame(animationId);
      observer.disconnect();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', handleResize);
      if (container && renderer.domElement) {
        container.removeChild(renderer.domElement);
      }
      sphereGeo.dispose();
      sphereMat.dispose();
      rimGeo.dispose();
      rimMat.dispose();
      diskGeo.dispose();
      diskMat.dispose();
      haloGeo.dispose();
      haloMat.dispose();
      streamGeo.dispose();
      streamMat.dispose();
      dustGeo.dispose();
      dustMat.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <div
      ref={mountRef}
      className="fixed inset-0 w-full h-full pointer-events-none z-0 overflow-hidden select-none"
      aria-hidden="true"
      style={{
        background: 'radial-gradient(ellipse at 50% 15%, rgba(24, 18, 55, 0.6) 0%, rgba(8, 10, 20, 0.95) 60%, #05060c 100%)',
      }}
    />
  );
};

export default CosmicSingularity;
