import * as THREE from "three";

export type ParticleType = "sparks" | "arc_flash" | "glass" | "smoke" | "thermal";

interface Particle {
  active: boolean;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  color: THREE.Color;
  size: number;
  life: number;
  maxLife: number;
  type: ParticleType;
  rotation: number;
  rotSpeed: number;
}

export class IndustrialParticleEngine {
  private particles: Particle[] = [];
  private maxParticles = 600;
  private geometry: THREE.BufferGeometry;
  private material: THREE.PointsMaterial;
  private points: THREE.Points;
  private positions: Float32Array;
  private colors: Float32Array;
  private sizes: Float32Array;

  constructor(scene: THREE.Scene) {
    this.positions = new Float32Array(this.maxParticles * 3);
    this.colors = new Float32Array(this.maxParticles * 3);
    this.sizes = new Float32Array(this.maxParticles);

    for (let i = 0; i < this.maxParticles; i++) {
      this.particles.push({
        active: false,
        position: new THREE.Vector3(),
        velocity: new THREE.Vector3(),
        color: new THREE.Color(),
        size: 1.0,
        life: 0,
        maxLife: 1.0,
        type: "sparks",
        rotation: 0,
        rotSpeed: 0,
      });
      this.sizes[i] = 0;
    }

    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute("position", new THREE.BufferAttribute(this.positions, 3));
    this.geometry.setAttribute("color", new THREE.BufferAttribute(this.colors, 3));
    this.geometry.setAttribute("size", new THREE.BufferAttribute(this.sizes, 1));

    // Custom particle canvas texture for crisp circular glow
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
      grad.addColorStop(0, "rgba(255, 255, 255, 1)");
      grad.addColorStop(0.3, "rgba(255, 200, 100, 0.9)");
      grad.addColorStop(0.7, "rgba(255, 80, 0, 0.4)");
      grad.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 64, 64);
    }
    const texture = new THREE.CanvasTexture(canvas);

    this.material = new THREE.PointsMaterial({
      size: 0.18,
      vertexColors: true,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      map: texture,
    });

    this.points = new THREE.Points(this.geometry, this.material);
    this.points.frustumCulled = false;
    scene.add(this.points);
  }

  public emitSparks(origin: THREE.Vector3, count = 40, velocityScale = 4.5) {
    let spawned = 0;
    for (const p of this.particles) {
      if (spawned >= count) break;
      if (!p.active) {
        p.active = true;
        p.type = "sparks";
        p.position.copy(origin).add(
          new THREE.Vector3(
            (Math.random() - 0.5) * 0.1,
            (Math.random() - 0.5) * 0.1,
            (Math.random() - 0.5) * 0.1
          )
        );

        // High velocity cone
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.random() * Math.PI * 0.5;
        p.velocity.set(
          Math.cos(theta) * Math.sin(phi) * velocityScale * (0.6 + Math.random() * 0.8),
          Math.cos(phi) * velocityScale * (0.8 + Math.random() * 0.6) + 1.2,
          Math.sin(theta) * Math.sin(phi) * velocityScale * (0.6 + Math.random() * 0.8)
        );

        p.color.setRGB(1.0, 0.65 + Math.random() * 0.35, 0.1);
        p.size = 0.22 + Math.random() * 0.15;
        p.life = 0;
        p.maxLife = 0.45 + Math.random() * 0.4;
        spawned++;
      }
    }
  }

  public emitArcFlash(origin: THREE.Vector3, count = 50) {
    let spawned = 0;
    for (const p of this.particles) {
      if (spawned >= count) break;
      if (!p.active) {
        p.active = true;
        p.type = "arc_flash";
        p.position.copy(origin).add(
          new THREE.Vector3(
            (Math.random() - 0.5) * 0.3,
            (Math.random() - 0.5) * 0.3,
            (Math.random() - 0.5) * 0.3
          )
        );

        p.velocity.set(
          (Math.random() - 0.5) * 8.0,
          (Math.random() - 0.5) * 8.0,
          (Math.random() - 0.5) * 8.0
        );

        // Brilliant blue-violet-white plasma
        p.color.setRGB(0.5 + Math.random() * 0.5, 0.7 + Math.random() * 0.3, 1.0);
        p.size = 0.32 + Math.random() * 0.2;
        p.life = 0;
        p.maxLife = 0.25 + Math.random() * 0.25;
        spawned++;
      }
    }
  }

  public emitGlassShards(origin: THREE.Vector3, count = 45) {
    let spawned = 0;
    for (const p of this.particles) {
      if (spawned >= count) break;
      if (!p.active) {
        p.active = true;
        p.type = "glass";
        p.position.copy(origin);
        p.velocity.set(
          (Math.random() - 0.5) * 5.0,
          Math.random() * 4.0 + 1.5,
          (Math.random() - 0.5) * 5.0
        );
        // Amber beverage bottle crystalline shards
        p.color.setRGB(0.85, 0.6, 0.25);
        p.size = 0.18 + Math.random() * 0.14;
        p.life = 0;
        p.maxLife = 0.6 + Math.random() * 0.4;
        spawned++;
      }
    }
  }

  public emitThermalFlare(origin: THREE.Vector3, count = 35) {
    let spawned = 0;
    for (const p of this.particles) {
      if (spawned >= count) break;
      if (!p.active) {
        p.active = true;
        p.type = "thermal";
        p.position.copy(origin).add(
          new THREE.Vector3(
            (Math.random() - 0.5) * 0.2,
            Math.random() * 0.2,
            (Math.random() - 0.5) * 0.2
          )
        );
        p.velocity.set(
          (Math.random() - 0.5) * 1.5,
          Math.random() * 2.8 + 1.0,
          (Math.random() - 0.5) * 1.5
        );
        p.color.setRGB(1.0, 0.35 + Math.random() * 0.3, 0.05);
        p.size = 0.35 + Math.random() * 0.25;
        p.life = 0;
        p.maxLife = 0.7 + Math.random() * 0.5;
        spawned++;
      }
    }
  }

  public update(dt: number) {
    let activeCount = 0;
    const gravity = -9.8;

    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      if (!p.active) {
        this.sizes[i] = 0;
        continue;
      }

      p.life += dt;
      if (p.life >= p.maxLife) {
        p.active = false;
        this.sizes[i] = 0;
        continue;
      }

      // Physics integration
      p.velocity.y += gravity * dt;
      p.position.addScaledVector(p.velocity, dt);

      // Floor bounce for metallic sparks and glass
      if (p.position.y < 0.02) {
        p.position.y = 0.02;
        p.velocity.y *= -0.38;
        p.velocity.x *= 0.65;
        p.velocity.z *= 0.65;
      }

      const lifeRatio = 1 - p.life / p.maxLife;

      // Write buffer attributes
      this.positions[i * 3 + 0] = p.position.x;
      this.positions[i * 3 + 1] = p.position.y;
      this.positions[i * 3 + 2] = p.position.z;

      this.colors[i * 3 + 0] = p.color.r * lifeRatio;
      this.colors[i * 3 + 1] = p.color.g * lifeRatio;
      this.colors[i * 3 + 2] = p.color.b * lifeRatio;

      this.sizes[i] = p.size * lifeRatio;
      activeCount++;
    }

    if (activeCount > 0) {
      this.geometry.attributes.position.needsUpdate = true;
      this.geometry.attributes.color.needsUpdate = true;
      this.geometry.attributes.size.needsUpdate = true;
    }
  }

  public clear() {
    for (let i = 0; i < this.particles.length; i++) {
      this.particles[i].active = false;
      this.sizes[i] = 0;
    }
    this.geometry.attributes.size.needsUpdate = true;
  }

  public dispose() {
    this.geometry.dispose();
    this.material.dispose();
  }
}
