import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { motion, useScroll, useTransform, useSpring } from 'framer-motion';

/**
 * QuantumCore3D — Compact, non-overlapping 3D WebGL core.
 * - Sits strictly in the empty side gutters (never overlaps text or cards)
 * - Layered behind content (z-0)
 * - Scaled down for sleek, jewelry-like elegance (~300px)
 */
const QuantumCore3D = () => {
  const mountRef = useRef(null);
  const mouseRef = useRef({ x: 0, y: 0, targetX: 0, targetY: 0 });

  // ── Framer Motion Scroll Path ──────────────────────────────────────────────
  const { scrollYProgress } = useScroll();

  // Smooth springs for fluid, calm movement
  const springConfig = { stiffness: 50, damping: 22, restDelta: 0.001 };

  // X position: ONLY in empty side gutters
  // 0.00 (Hero)         -> Far Right gutter (+42vw)
  // 0.22 (Features top) -> Far Left gutter  (-42vw) [Red circle 1]
  // 0.48 (Features mid) -> Far Left gutter  (-43vw) [Red circle 2]
  // 0.68 (How It Works) -> Far Left gutter  (-42vw) [Red circle 3]
  // 0.85 (Testimonials) -> Far Right gutter (+42vw) [Clear of cards]
  // 1.00 (Final CTA)    -> Far Right gutter (+41vw) [Clear of CTA]
  const rawX = useTransform(
    scrollYProgress,
    [0, 0.22, 0.48, 0.68, 0.85, 1],
    ['41vw', '-42vw', '-43vw', '-42vw', '42vw', '41vw']
  );
  const x = useSpring(rawX, springConfig);

  // Y position: Tracks viewport smoothly down the page
  const rawY = useTransform(
    scrollYProgress,
    [0, 0.22, 0.48, 0.68, 0.85, 1],
    ['22vh', '38vh', '50vh', '56vh', '64vh', '72vh']
  );
  const y = useSpring(rawY, springConfig);

  // Scale: Compact and proportional (stays around 0.88 - 1.05)
  const rawScale = useTransform(scrollYProgress, [0, 0.3, 0.7, 1], [0.95, 1.05, 0.92, 1.0]);
  const scale = useSpring(rawScale, springConfig);

  // Rotation on scroll
  const rotateZ = useTransform(scrollYProgress, [0, 1], [0, 360]);

  // ── Three.js Scene Setup ───────────────────────────────────────────────────
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 280;
    const height = container.clientHeight || 280;

    // 1. Scene & Camera
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.z = 4.6;

    // 2. WebGL Renderer with alpha transparency
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    // 3. 3D Root Group
    const coreGroup = new THREE.Group();
    scene.add(coreGroup);

    // ── Mesh 1: Outer Holographic Wireframe Icosahedron (Compact: radius 0.95) ──
    const outerGeo = new THREE.IcosahedronGeometry(0.95, 1);
    const outerMat = new THREE.MeshStandardMaterial({
      color: 0x818cf8, // Indigo-400
      wireframe: true,
      transparent: true,
      opacity: 0.45,
      roughness: 0.2,
      metalness: 0.85,
    });
    const outerMesh = new THREE.Mesh(outerGeo, outerMat);
    coreGroup.add(outerMesh);

    // ── Mesh 2: Inner Faceted Crystal Core (Compact: radius 0.58) ──
    const innerGeo = new THREE.OctahedronGeometry(0.58, 0);
    const innerMat = new THREE.MeshPhysicalMaterial({
      color: 0xa855f7, // Purple-500
      emissive: 0x4f46e5,
      emissiveIntensity: 0.35,
      roughness: 0.1,
      metalness: 0.9,
      clearcoat: 1.0,
      clearcoatRoughness: 0.1,
      transparent: true,
      opacity: 0.85,
    });
    const innerMesh = new THREE.Mesh(innerGeo, innerMat);
    coreGroup.add(innerMesh);

    // ── Mesh 3: Glowing Nucleus Sphere (Compact: radius 0.22) ──
    const nucleusGeo = new THREE.SphereGeometry(0.22, 16, 16);
    const nucleusMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8, // Sky-400 cyan
      transparent: true,
      opacity: 0.9,
    });
    const nucleusMesh = new THREE.Mesh(nucleusGeo, nucleusMat);
    coreGroup.add(nucleusMesh);

    // ── Mesh 4: Orbital Ring A (Compact: radius 1.25) ──
    const ringGeoA = new THREE.TorusGeometry(1.25, 0.015, 16, 100);
    const ringMatA = new THREE.MeshBasicMaterial({
      color: 0x6366f1,
      transparent: true,
      opacity: 0.55,
    });
    const ringA = new THREE.Mesh(ringGeoA, ringMatA);
    ringA.rotation.x = Math.PI / 3;
    coreGroup.add(ringA);

    // ── Mesh 5: Orbital Ring B (Compact: radius 1.45) ──
    const ringGeoB = new THREE.TorusGeometry(1.45, 0.013, 16, 100);
    const ringMatB = new THREE.MeshBasicMaterial({
      color: 0xc084fc,
      transparent: true,
      opacity: 0.45,
    });
    const ringB = new THREE.Mesh(ringGeoB, ringMatB);
    ringB.rotation.y = Math.PI / 4;
    ringB.rotation.x = -Math.PI / 6;
    coreGroup.add(ringB);

    // ── Mesh 6: Floating Satellite Nodes (Compact orbit) ──
    const particleCount = 35;
    const particleGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      const radius = 1.3 + Math.random() * 0.5;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = radius * Math.cos(phi);
    }
    particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const particleMat = new THREE.PointsMaterial({
      color: 0x38bdf8,
      size: 0.045,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending,
    });
    const particleField = new THREE.Points(particleGeo, particleMat);
    coreGroup.add(particleField);

    // ── Lights ──
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
    scene.add(ambientLight);

    const pointLight1 = new THREE.PointLight(0x6366f1, 40, 10);
    pointLight1.position.set(3, 3, 3);
    scene.add(pointLight1);

    const pointLight2 = new THREE.PointLight(0xec4899, 30, 10);
    pointLight2.position.set(-3, -3, 2);
    scene.add(pointLight2);

    // ── Mouse Move Parallax Listener ──
    const handleMouseMove = (e) => {
      const { innerWidth, innerHeight } = window;
      mouseRef.current.targetX = (e.clientX / innerWidth - 0.5) * 1.0;
      mouseRef.current.targetY = (e.clientY / innerHeight - 0.5) * 1.0;
    };
    window.addEventListener('mousemove', handleMouseMove);

    // ── Animation Loop ──
    let animationFrameId;
    const clock = new THREE.Clock();
    let isVisible = true;

    // Pause WebGL rendering when canvas is scrolled off-screen
    const observer = new IntersectionObserver(
      ([entry]) => {
        isVisible = entry.isIntersecting;
      },
      { threshold: 0.05 }
    );
    observer.observe(container);

    // Pause rendering when tab is hidden
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
      animationFrameId = requestAnimationFrame(animate);
      if (!isVisible) return; // Pause full 3D rendering when off-screen

      const delta = clock.getDelta();
      const time = clock.getElapsedTime();

      // Smooth mouse interpolation
      mouseRef.current.x += (mouseRef.current.targetX - mouseRef.current.x) * 0.05;
      mouseRef.current.y += (mouseRef.current.targetY - mouseRef.current.y) * 0.05;

      // Rotations
      outerMesh.rotation.x += 0.25 * delta;
      outerMesh.rotation.y += 0.35 * delta;

      innerMesh.rotation.x -= 0.4 * delta;
      innerMesh.rotation.y -= 0.5 * delta;

      // Nucleus pulse
      const pulse = 1 + Math.sin(time * 3) * 0.08;
      nucleusMesh.scale.set(pulse, pulse, pulse);

      // Rings rotation
      ringA.rotation.z += 0.3 * delta;
      ringA.rotation.x += 0.15 * delta;
      ringB.rotation.z -= 0.25 * delta;
      ringB.rotation.y += 0.2 * delta;

      // Orbit particles
      particleField.rotation.y += 0.12 * delta;

      // Parallax Tilt based on cursor
      coreGroup.rotation.y = mouseRef.current.x * 0.7;
      coreGroup.rotation.x = mouseRef.current.y * 0.7;

      // Gentle levitation bobbing
      coreGroup.position.y = Math.sin(time * 1.5) * 0.08;

      renderer.render(scene, camera);
    };

    animate();

    // ── Cleanup ──
    return () => {
      cancelAnimationFrame(animationFrameId);
      observer.disconnect();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('mousemove', handleMouseMove);
      if (container && renderer.domElement) {
        container.removeChild(renderer.domElement);
      }
      outerGeo.dispose();
      outerMat.dispose();
      innerGeo.dispose();
      innerMat.dispose();
      nucleusGeo.dispose();
      nucleusMat.dispose();
      ringGeoA.dispose();
      ringMatA.dispose();
      ringGeoB.dispose();
      ringMatB.dispose();
      particleGeo.dispose();
      particleMat.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <motion.div
      style={{
        x,
        y,
        scale,
        rotateZ,
      }}
      // Fixed, strictly pointer-events-none, strictly BEHIND content (z-0), visible on desktop (hidden on mobile)
      className="fixed top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-0 select-none hidden xl:block"
      aria-hidden="true"
    >
      {/* Soft atmospheric ambient glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-gradient-to-tr from-indigo-500/15 via-purple-500/20 to-cyan-500/15 rounded-full blur-2xl pointer-events-none" />

      {/* 3D Canvas Mount Point — Compact ~280px */}
      <div
        ref={mountRef}
        className="w-[280px] h-[280px] relative pointer-events-none"
      />
    </motion.div>
  );
};

export default QuantumCore3D;
