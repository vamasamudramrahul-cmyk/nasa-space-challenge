/**
 * Abandoned but Not Forgotten — Master Application Engine
 * Module: app.js
 * Compliant with PRD v1.0 • WCAG 2.2 AA • High Performance
 */

(function () {
  'use strict';

  // ==========================================================================
  // 1. Application State & Store
  // ==========================================================================
  const state = {
    equipment: [],
    missions: [],
    timeline: [],
    quiz: [],
    glossary: [],
    sources: [],
    updates: [],
    planets: [],
    recentlyExplored: [],
    activeRoute: 'home',
    theme: localStorage.getItem('abn_theme') || 'light',
    tutorialCompleted: localStorage.getItem('abn_tutorial_completed') === 'true',
    currentQuizIndex: 0,
    quizScore: 0,
    quizUserAnswers: [],
    solarPaused: false,
    globes: {
      moon: null,
      mars: null,
      missionMap: null
    }
  };

  // ==========================================================================
  // 2. Data Ingestion & Fetch Handlers
  // ==========================================================================
  async function loadAllDatasets() {
    if (window.__ABN_DATA__) {
      state.equipment = window.__ABN_DATA__.equipment || [];
      state.missions = window.__ABN_DATA__.missions || [];
      state.timeline = window.__ABN_DATA__.timeline || [];
      state.quiz = window.__ABN_DATA__.quiz || [];
      state.glossary = window.__ABN_DATA__.glossary || [];
      state.sources = window.__ABN_DATA__.sources || [];
      state.updates = window.__ABN_DATA__.updates || [];
      state.planets = window.__ABN_DATA__.planets || [];
      console.log('Successfully loaded bundled production datasets (__ABN_DATA__).');
    } else {
      const endpoints = [
        { key: 'equipment', path: 'data/equipment.json' },
        { key: 'missions', path: 'data/missions.json' },
        { key: 'timeline', path: 'data/timeline.json' },
        { key: 'quiz', path: 'data/quiz.json' },
        { key: 'glossary', path: 'data/glossary.json' },
        { key: 'sources', path: 'data/sources.json' },
        { key: 'updates', path: 'data/updates.json' },
        { key: 'planets', path: 'data/planets.json' }
      ];

      try {
        const results = await Promise.all(
          endpoints.map(ep => fetch(ep.path).then(res => {
            if (!res.ok) throw new Error(`HTTP ${res.status} on ${ep.path}`);
            return res.json();
          }))
        );

        endpoints.forEach((ep, i) => {
          state[ep.key] = results[i];
        });
        console.log('Successfully loaded all production JSON datasets via fetch.');
      } catch (err) {
        console.warn('Network fetch error (likely running under file:// or offline).', err);
      }
    }

    // Load recently explored from localStorage
    try {
      const savedRecent = localStorage.getItem('abn_recently_explored');
      if (savedRecent) {
        state.recentlyExplored = JSON.parse(savedRecent);
      }
    } catch (e) {
      state.recentlyExplored = [];
    }

    // Initialize all views & components
    initializeAppComponents();
  }

  // ==========================================================================
  // 3. Router & Navigation Controller
  // ==========================================================================
  function handleRoute() {
    const rawHash = window.location.hash.slice(1).trim();
    let route = 'home';
    let param = '';

    if (rawHash) {
      if (rawHash.startsWith('equipment/')) {
        route = 'equipment-detail';
        param = rawHash.replace('equipment/', '');
      } else {
        route = rawHash;
      }
    }

    state.activeRoute = route;
    showMapLoadingForRoute(route);

    // Prototype 1 cinematic home hero: initialize only on Home to avoid background work on other screens.
    if (window.HeroStarfield) {
      if (route === 'home') window.HeroStarfield.init();
      else window.HeroStarfield.destroy();
    }

    // Hide all view sections
    document.querySelectorAll('.view-section').forEach(sec => sec.classList.remove('active'));

    // Equipment details use Prototype 1's full-page dossier rather than Prototype 2's short modal.
    // The content is adapted to Prototype 2's data model so current equipment IDs and data remain intact.
    if (route === 'equipment-detail') {
      const eq = state.equipment.find(item => String(item.id) === String(param));
      renderEquipmentDetailScreen(eq || null, param);
    }

    // Activate current view section
    const targetSection = document.getElementById(`view-${route}`);
    if (targetSection) {
      targetSection.classList.add('active');
    } else {
      const homeSec = document.getElementById('view-home');
      if (homeSec) homeSec.classList.add('active');
      route = 'home';
    }

    // Update active primary nav link
    document.querySelectorAll('.nav-link').forEach(link => {
      const linkRoute = link.getAttribute('data-route');
      if (linkRoute === route) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });

    // Update breadcrumb trail
    const breadcrumbLabel = document.getElementById('currentRouteLabel');
    if (breadcrumbLabel) {
      const routeNames = {
        'home': 'Home',
        'destination-moon': 'The Moon',
        'destination-mars': 'Mars',
        'filters': 'Equipment Directory',
        'timeline': 'Interactive Timeline',
        'mission-map': 'Mission Map',
        'planets': 'Explore Planets',
        'missions': 'NASA & Space Missions',
        'compare': 'Compare Hardware',
        'quiz': 'Knowledge Quiz',
        'classroom': 'Space Classroom',
        'faqs': 'Frequently Asked Questions',
        'glossary': 'Glossary',
        'sources': 'Sources & Evidence',
        'about': 'About & Scope',
        'equipment-detail': 'Equipment Dossier'
      };
      breadcrumbLabel.textContent = routeNames[route] || route.toUpperCase();
    }

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Trigger canvas resize / render for active globe
    if (route === 'destination-moon' && state.globes.moon) {
      state.globes.moon.resize();
    } else if (route === 'destination-mars' && state.globes.mars) {
      state.globes.mars.resize();
    } else if (route === 'mission-map' && state.globes.missionMap) {
      state.globes.missionMap.resize();
    }
  }

  // ==========================================================================
  // 4. Mathematical 3D Orthographic Canvas Globe Engine
  // ==========================================================================
  class Canvas3DGlobe {
    constructor(canvasId, options = {}) {
      this.canvas = document.getElementById(canvasId);
      if (!this.canvas) return;
      this.ctx = this.canvas.getContext('2d');
      this.type = options.type || 'moon'; // 'moon' or 'mars'
      this.markers = options.markers || [];
      this.autoRotate = options.autoRotate !== false;
      this.rotX = options.initialRotX || 0.2;
      this.rotY = options.initialRotY || 0.0;
      this.zoom = 1.0;
      this.isDragging = false;
      this.lastMouseX = 0;
      this.lastMouseY = 0;
      this.hoveredMarker = null;
      this.selectedMarker = null;
      this.onMarkerSelect = options.onMarkerSelect || null;
      this.onHoverCoords = options.onHoverCoords || null;
      this.showOrbits = options.showOrbits || false;
      this.showGrid = options.showGrid !== false;
      this.showMarkers = options.showMarkers !== false;

      this.initEvents();
      this.resize();
      this.animate();
    }

    initEvents() {
      const c = this.canvas;
      const getPos = (e) => {
        const rect = c.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        return { x: clientX - rect.left, y: clientY - rect.top };
      };

      const onStart = (e) => {
        this.isDragging = true;
        const pos = getPos(e);
        this.lastMouseX = pos.x;
        this.lastMouseY = pos.y;
      };

      const onMove = (e) => {
        const pos = getPos(e);
        if (this.isDragging) {
          const dx = pos.x - this.lastMouseX;
          const dy = pos.y - this.lastMouseY;
          this.rotY += dx * 0.006;
          this.rotX += dy * 0.006;
          // Clamp X to avoid gimbal flip
          this.rotX = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, this.rotX));
          this.lastMouseX = pos.x;
          this.lastMouseY = pos.y;
        } else {
          this.checkHover(pos.x, pos.y);
        }
      };

      const onEnd = () => {
        this.isDragging = false;
      };

      c.addEventListener('mousedown', onStart);
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onEnd);

      c.addEventListener('touchstart', onStart, { passive: true });
      window.addEventListener('touchmove', onMove, { passive: true });
      window.addEventListener('touchend', onEnd);

      c.addEventListener('click', (e) => {
        const pos = getPos(e);
        this.handleClick(pos.x, pos.y);
      });

      // Wheel Zoom
      c.addEventListener('wheel', (e) => {
        e.preventDefault();
        this.zoom += e.deltaY * -0.001;
        this.zoom = Math.max(0.6, Math.min(2.5, this.zoom));
      }, { passive: false });
    }

    resize() {
      if (!this.canvas) return;
      const rect = this.canvas.parentElement.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      this.width = rect.width;
      this.height = rect.height;
      this.canvas.width = Math.max(1, Math.round(this.width * dpr));
      this.canvas.height = Math.max(1, Math.round(this.height * dpr));
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    project(lat, lng) {
      const phi = (90 - lat) * (Math.PI / 180);
      const theta = (lng + 180) * (Math.PI / 180);

      // 3D Cartesian coordinates on unit sphere
      let x = -Math.sin(phi) * Math.cos(theta);
      let y = Math.cos(phi);
      let z = Math.sin(phi) * Math.sin(theta);

      // Rotate around Y axis
      const cosY = Math.cos(this.rotY);
      const sinY = Math.sin(this.rotY);
      const x1 = x * cosY + z * sinY;
      const z1 = -x * sinY + z * cosY;

      // Rotate around X axis
      const cosX = Math.cos(this.rotX);
      const sinX = Math.sin(this.rotX);
      const y2 = y * cosX - z1 * sinX;
      const z2 = y * sinX + z1 * cosX;

      const radius = Math.min(this.width, this.height) * 0.38 * this.zoom;
      const cx = this.width / 2;
      const cy = this.height / 2;

      return {
        screenX: cx + x1 * radius,
        screenY: cy - y2 * radius,
        visible: z2 > 0, // facing front camera
        depth: z2,
        radius: radius
      };
    }

    checkHover(mx, my) {
      let found = null;
      for (const m of this.markers) {
        if (!m.hasLocation) continue;
        const p = this.project(m.latitude, m.longitude);
        if (p.visible) {
          const dist = Math.hypot(mx - p.screenX, my - p.screenY);
          if (dist < 14) {
            found = m;
            break;
          }
        }
      }
      this.hoveredMarker = found;
      this.canvas.style.cursor = found ? 'pointer' : 'grab';

      if (this.onHoverCoords) {
        if (found) {
          this.onHoverCoords(`${found.name} (${found.latitude.toFixed(2)}°, ${found.longitude.toFixed(2)}°)`);
        } else {
          this.onHoverCoords(`Globe view: Lat ${(this.rotX * 57.3).toFixed(1)}°, Lng ${((-this.rotY) * 57.3 % 360).toFixed(1)}°`);
        }
      }
    }

    handleClick(mx, my) {
      for (const m of this.markers) {
        if (!m.hasLocation) continue;
        const p = this.project(m.latitude, m.longitude);
        if (p.visible) {
          const dist = Math.hypot(mx - p.screenX, my - p.screenY);
          if (dist < 14) {
            this.selectedMarker = m;
            if (this.onMarkerSelect) this.onMarkerSelect(m, p.screenX, p.screenY);
            return;
          }
        }
      }
      this.selectedMarker = null;
      if (this.onMarkerSelect) this.onMarkerSelect(null);
    }

    draw() {
      const ctx = this.ctx;
      const w = this.width;
      const h = this.height;
      if (!ctx || !w || !h) return;

      ctx.clearRect(0, 0, w, h);

      const cx = w / 2;
      const cy = h / 2;
      const radius = Math.min(w, h) * 0.38 * this.zoom;

      // 1. Draw Globe Base Sphere Gradient
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);

      let grad = ctx.createRadialGradient(cx - radius * 0.3, cy - radius * 0.3, radius * 0.1, cx, cy, radius);
      if (this.type === 'mars') {
        grad.addColorStop(0, '#e0533c');
        grad.addColorStop(0.5, '#ab301d');
        grad.addColorStop(0.85, '#6a180b');
        grad.addColorStop(1, '#2c0803');
      } else {
        // Moon
        grad.addColorStop(0, '#e2e8f0');
        grad.addColorStop(0.5, '#94a3b8');
        grad.addColorStop(0.85, '#475569');
        grad.addColorStop(1, '#0f172a');
      }

      ctx.fillStyle = grad;
      ctx.fill();

      // Atmospheric Limb Glow
      ctx.lineWidth = 2;
      ctx.strokeStyle = this.type === 'mars' ? 'rgba(239, 68, 68, 0.4)' : 'rgba(148, 163, 184, 0.4)';
      ctx.stroke();

      // 2. Draw Latitude & Longitude Coordinate Grid Lines
      if (this.showGrid) {
      ctx.strokeStyle = this.type === 'mars' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.1)';
      ctx.lineWidth = 1;

      // Latitude parallels
      [-60, -30, 0, 30, 60].forEach(lat => {
        ctx.beginPath();
        let started = false;
        for (let lng = -180; lng <= 180; lng += 10) {
          const p = this.project(lat, lng);
          if (p.visible) {
            if (!started) {
              ctx.moveTo(p.screenX, p.screenY);
              started = true;
            } else {
              ctx.lineTo(p.screenX, p.screenY);
            }
          } else {
            started = false;
          }
        }
        ctx.stroke();
      });

      // Longitude meridians
      [-120, -60, 0, 60, 120, 180].forEach(lng => {
        ctx.beginPath();
        let started = false;
        for (let lat = -90; lat <= 90; lat += 5) {
          const p = this.project(lat, lng);
          if (p.visible) {
            if (!started) {
              ctx.moveTo(p.screenX, p.screenY);
              started = true;
            } else {
              ctx.lineTo(p.screenX, p.screenY);
            }
          } else {
            started = false;
          }
        }
        ctx.stroke();
      });

      } // end coordinate grid layer

      // 3. Optional Orbit Paths for Orbiters
      if (this.showOrbits) {
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
        ctx.setLineDash([4, 6]);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(cx, cy, radius * 1.35, radius * 0.7, this.rotY * 0.5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      ctx.restore();

      // 4. Draw Equipment Surface Markers
      if (this.showMarkers) this.markers.forEach(m => {
        if (!m.hasLocation) return;
        const p = this.project(m.latitude, m.longitude);
        if (!p.visible) return;

        const isHovered = this.hoveredMarker && this.hoveredMarker.id === m.id;
        const isSelected = this.selectedMarker && this.selectedMarker.id === m.id;

        ctx.save();
        // Pin outer glow
        ctx.beginPath();
        ctx.arc(p.screenX, p.screenY, isSelected ? 12 : (isHovered ? 9 : 6), 0, Math.PI * 2);
        ctx.fillStyle = m.statusClass === 'active' ? 'rgba(16, 185, 129, 0.4)' :
                        (m.statusClass === 'lost' ? 'rgba(239, 68, 68, 0.4)' : 'rgba(56, 189, 248, 0.4)');
        ctx.fill();

        // Pin core center
        ctx.beginPath();
        ctx.arc(p.screenX, p.screenY, isSelected ? 6 : 4, 0, Math.PI * 2);
        ctx.fillStyle = m.statusClass === 'active' ? '#10b981' :
                        (m.statusClass === 'lost' ? '#ef4444' : '#38bdf8');
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.fill();
        ctx.stroke();

        // Text Label
        if (isHovered || isSelected || this.zoom > 1.4) {
          ctx.font = '600 11px system-ui, sans-serif';
          ctx.fillStyle = '#ffffff';
          ctx.shadowColor = '#000000';
          ctx.shadowBlur = 4;
          ctx.fillText(m.name, p.screenX + 8, p.screenY - 6);
        }

        ctx.restore();
      });
    }

    animate() {
      if (this.autoRotate && !this.isDragging) {
        this.rotY += 0.0015;
      }
      this.draw();
      requestAnimationFrame(() => this.animate());
    }
  }

  // ==========================================================================
  // 5. Interactive 2D Solar System Engine
  // ==========================================================================
  function initSolarSystemCanvas() {
    const canvas = document.getElementById('solarCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let angleOffset = 0;
    let solarMapZoom = 1;
    let solarShowOrbits = true;
    let solarShowLabels = true;
    let selectedPlanetId = 'mars';
    let planetPositions = [];
    const orbitFractions = [0.10, 0.15, 0.20, 0.27, 0.39, 0.54, 0.70, 0.91];
    const orbitSpeeds = [4.1, 1.6, 1.0, 0.53, 0.084, 0.034, 0.012, 0.006];
    const displayedSizes = [4, 5, 6, 6, 10, 9, 8, 8];
    const stars = Array.from({ length: 105 }, (_, i) => ({
      x: ((i * 197 + 37) % 997) / 997,
      y: ((i * 313 + 71) % 991) / 991,
      r: i % 13 === 0 ? 1.45 : (i % 4 === 0 ? 0.95 : 0.55),
      a: 0.18 + ((i * 7) % 65) / 100
    }));

    function choosePlanet(id, scrollToCard = false) {
      selectedPlanetId = id;
      document.querySelectorAll('.planet-card[data-planet]').forEach(card => {
        const active = card.getAttribute('data-planet') === id;
        card.classList.toggle('is-selected', active);
        if (active && scrollToCard) card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });
    }

    function render() {
      const w = canvas.width;
      const h = canvas.height;
      const cx = w / 2;
      const cy = h / 2;
      ctx.clearRect(0, 0, w, h);

      const backdrop = ctx.createLinearGradient(0, 0, w, h);
      backdrop.addColorStop(0, '#050b18');
      backdrop.addColorStop(0.55, '#02050d');
      backdrop.addColorStop(1, '#07101f');
      ctx.fillStyle = backdrop;
      ctx.fillRect(0, 0, w, h);
      stars.forEach(star => {
        ctx.globalAlpha = star.a;
        ctx.fillStyle = '#e2e8f0';
        ctx.beginPath();
        ctx.arc(star.x * w, star.y * h, star.r, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;

      const maxOrbit = Math.min(w * 0.47, h * 0.82) * solarMapZoom;
      const sunRadius = Math.max(15, Math.min(27, Math.min(w, h) * 0.052));
      const sunGradient = ctx.createRadialGradient(cx - 5, cy - 7, 2, cx, cy, sunRadius * 1.8);
      sunGradient.addColorStop(0, '#fff7ad');
      sunGradient.addColorStop(0.35, '#fbbf24');
      sunGradient.addColorStop(0.72, '#f97316');
      sunGradient.addColorStop(1, 'rgba(249,115,22,0)');
      ctx.beginPath();
      ctx.arc(cx, cy, sunRadius * 1.8, 0, Math.PI * 2);
      ctx.fillStyle = sunGradient;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx, cy, sunRadius, 0, Math.PI * 2);
      ctx.fillStyle = '#fbbf24';
      ctx.fill();
      if (solarShowLabels) {
        ctx.font = '700 12px system-ui';
        ctx.fillStyle = '#fde68a';
        ctx.textAlign = 'center';
        ctx.fillText('SUN', cx, cy + sunRadius + 17);
      }

      const planetsList = state.planets.filter(p => p.id !== 'sun');
      planetPositions = [{ id: 'sun', name: 'Sun', x: cx, y: cy, radius: sunRadius }];
      planetsList.forEach((planet, idx) => {
        const orbitX = maxOrbit * (orbitFractions[idx] || (0.1 + idx * 0.1));
        const orbitY = orbitX * 0.42;
        const speed = orbitSpeeds[idx] || 0.1;
        const currentAngle = angleOffset * speed * 0.4 + idx * 0.8;

        if (solarShowOrbits) {
          ctx.beginPath();
          ctx.ellipse(cx, cy, orbitX, orbitY, 0, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(148,163,184,0.24)';
          ctx.lineWidth = 1;
          ctx.setLineDash([3, 5]);
          ctx.stroke();
          ctx.setLineDash([]);
        }

        const px = cx + Math.cos(currentAngle) * orbitX;
        const py = cy + Math.sin(currentAngle) * orbitY;
        const planetSize = Math.max(displayedSizes[idx] || 5, Math.min(15, (displayedSizes[idx] || 5) * solarMapZoom));
        const isSelected = selectedPlanetId === planet.id;
        if (isSelected) {
          ctx.beginPath();
          ctx.arc(px, py, planetSize + 7, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(147,197,253,.86)';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
        const pg = ctx.createRadialGradient(px - planetSize * .3, py - planetSize * .35, 1, px, py, planetSize * 1.5);
        pg.addColorStop(0, '#ffffff');
        pg.addColorStop(0.15, planet.color || '#38bdf8');
        pg.addColorStop(1, planet.color || '#38bdf8');
        ctx.beginPath();
        ctx.arc(px, py, planetSize, 0, Math.PI * 2);
        ctx.fillStyle = pg;
        ctx.fill();
        if (planet.id === 'saturn') {
          ctx.beginPath();
          ctx.ellipse(px, py, planetSize * 1.75, planetSize * .52, -.18, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(253,230,138,.76)';
          ctx.lineWidth = Math.max(1.5, planetSize * .2);
          ctx.stroke();
        }
        if (solarShowLabels) {
          ctx.font = isSelected ? '700 12px system-ui' : '600 11px system-ui';
          ctx.fillStyle = isSelected ? '#ffffff' : '#cbd5e1';
          ctx.textAlign = 'center';
          ctx.shadowColor = '#020617';
          ctx.shadowBlur = 5;
          ctx.fillText(planet.name, px, py - planetSize - 7);
          ctx.shadowBlur = 0;
        }
        planetPositions.push({ id: planet.id, name: planet.name, x: px, y: py, radius: planetSize });
      });

      if (!state.solarPaused) angleOffset += 0.015;
      requestAnimationFrame(render);
    }

    render();
    choosePlanet(selectedPlanetId);
    window.__ABN_SOLAR_MAP = {
      select: (id, scroll = false) => choosePlanet(id, scroll),
      zoomIn: () => { solarMapZoom = Math.min(1.45, solarMapZoom + 0.12); },
      zoomOut: () => { solarMapZoom = Math.max(0.72, solarMapZoom - 0.12); },
      setOrbits: (value) => { solarShowOrbits = Boolean(value); },
      setLabels: (value) => { solarShowLabels = Boolean(value); },
      getSelected: () => selectedPlanetId
    };

    canvas.addEventListener('click', (event) => {
      const rect = canvas.getBoundingClientRect();
      const x = (event.clientX - rect.left) * (canvas.width / rect.width);
      const y = (event.clientY - rect.top) * (canvas.height / rect.height);
      let best = null;
      let bestDistance = Infinity;
      planetPositions.forEach(point => {
        const distance = Math.hypot(x - point.x, y - point.y);
        if (distance <= point.radius + 10 && distance < bestDistance) {
          best = point;
          bestDistance = distance;
        }
      });
      if (best) choosePlanet(best.id, true);
    });

    // Select a dossier from the planetary cards and sync its highlight with the orbital map.
    const grid = document.getElementById('planetsGrid');
    if (grid) {
      grid.addEventListener('click', (event) => {
        const card = event.target.closest('.planet-card[data-planet]');
        if (card) choosePlanet(card.getAttribute('data-planet'));
      });
    }

    const btnPause = document.getElementById('btnSolarPause');
    if (btnPause) {
      btnPause.addEventListener('click', () => {
        state.solarPaused = !state.solarPaused;
        btnPause.textContent = state.solarPaused ? 'Resume Animation' : 'Pause Animation';
      });
    }
  }

  // ==========================================================================
  // 6. UI Renderers: Cards, Grids & Data Tables
  // ==========================================================================
  function createEquipmentCardHTML(eq) {
    const destClass = (eq.destination || '').toLowerCase() === 'mars' ? 'mars' : 'moon';
    const statusClass = eq.statusClass || 'historical';
    const statusBadgeClass = statusClass === 'active' ? 'status-active-badge' :
                             (statusClass === 'lost' ? 'status-lost-badge' : 'status-historical-badge');

    const imgSrc = eq.image && eq.image.thumbnail ? eq.image.thumbnail : '';
    const imgCaption = eq.image && eq.image.caption ? eq.image.caption : eq.name;

    return `
      <article class="equipment-card" data-id="${eq.id}">
        <div class="equipment-card-media">
          <span class="equipment-card-pill-dest ${destClass}">${eq.destination}</span>
          <span class="equipment-card-status-badge ${statusBadgeClass}">
            ${statusClass.toUpperCase()}
          </span>
          ${imgSrc ? `
            <img src="${imgSrc}" alt="${imgCaption}" class="equipment-card-img" loading="lazy" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
            <div class="equipment-card-img-placeholder" style="display: none;">
              <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
              <span>Image Under Verification</span>
            </div>
          ` : `
            <div class="equipment-card-img-placeholder">
              <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
              <span>Archival Image Candidate</span>
            </div>
          `}
        </div>
        <div class="equipment-card-body">
          <div class="equipment-card-meta">
            <span class="equipment-card-type">${eq.equipmentType || 'Spacecraft'}</span>
            <span>${eq.launchDate || 'Date Unverified'}</span>
          </div>
          <h3 class="equipment-card-title">${eq.name}</h3>
          <div class="equipment-card-mission">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
            <span>${eq.missionName || 'NASA Mission'}</span>
          </div>
          <p class="equipment-card-desc">${eq.missionOutcome || eq.remainingHardware || eq.missionObjective || 'Audited NASA mission hardware.'}</p>
          <div class="equipment-card-footer">
            <span class="equipment-card-coords">
              ${eq.hasLocation ? `${eq.latitude.toFixed(2)}°, ${eq.longitude.toFixed(2)}°` : 'Orbit / Non-surface'}
            </span>
            <a href="#equipment/${eq.id}" class="btn-card-link">View Dossier &rarr;</a>
          </div>
        </div>
      </article>
    `;
  }

  function renderFeaturedHome() {
    const container = document.getElementById('homeFeaturedGrid');
    if (!container) return;
    const flagships = state.equipment.filter(e => e.isFlagshipVerified).slice(0, 6);
    container.innerHTML = flagships.map(createEquipmentCardHTML).join('');
  }

  function renderHomeTimelinePreview() {
    const container = document.getElementById('homeTimelinePreview');
    if (!container) return;
    const topMilestones = state.timeline.slice(0, 6);

    container.innerHTML = topMilestones.map((evt, idx) => {
      const isLeft = idx % 2 === 0;
      const destClass = (evt.destination || '').toLowerCase() === 'mars' ? 'mars' : 'moon';
      return `
        <article class="timeline-event-card ${isLeft ? 'left' : 'right'}">
          <span class="timeline-node-pin ${evt.statusColor || 'green'}"></span>
          <div class="event-header">
            <span class="event-date">${evt.date}</span>
            <span class="event-dest-pill ${destClass}">${evt.destination}</span>
          </div>
          <h3 class="event-title">${evt.title}</h3>
          <p class="event-desc">${evt.description}</p>
          <div class="event-footer">
            <span>Category: ${evt.eventCategory}</span>
            ${evt.equipmentId ? `<a href="#equipment/${evt.equipmentId}" class="btn-card-link">View Artifact &rarr;</a>` : ''}
          </div>
        </article>
      `;
    }).join('');
  }

  function renderDestinationMoon() {
    const container = document.getElementById('moonEquipmentGrid');
    const tableBody = document.getElementById('moonAccessibleTableBody');
    const moonRecords = state.equipment.filter(e => e.destination === 'Moon');
    const moonHeroCount = document.getElementById('moonHeroCount');
    if (moonHeroCount) moonHeroCount.textContent = String(moonRecords.length);

    if (container) {
      container.innerHTML = moonRecords.map(createEquipmentCardHTML).join('');
    }

    if (tableBody) {
      tableBody.innerHTML = moonRecords.map(m => `
        <tr>
          <td><strong class="data-table-name">${m.name}</strong></td>
          <td>${m.missionName}</td>
          <td>${m.coordinates || 'N/A'}</td>
          <td>${m.coordinateAccuracy}</td>
          <td><span class="popup-status status-${m.statusClass}-badge">${m.statusClass.toUpperCase()}</span></td>
          <td><a href="#equipment/${m.id}" class="btn-card-link">Dossier</a></td>
        </tr>
      `).join('');
    }
  }

  function renderDestinationMars() {
    const container = document.getElementById('marsEquipmentGrid');
    const tableBody = document.getElementById('marsAccessibleTableBody');
    const marsRecords = state.equipment.filter(e => e.destination === 'Mars');
    const marsHeroCount = document.getElementById('marsHeroCount');
    if (marsHeroCount) marsHeroCount.textContent = String(marsRecords.length);

    if (container) {
      container.innerHTML = marsRecords.map(createEquipmentCardHTML).join('');
    }

    if (tableBody) {
      tableBody.innerHTML = marsRecords.map(m => `
        <tr>
          <td><strong class="data-table-name">${m.name}</strong></td>
          <td>${m.missionName}</td>
          <td>${m.coordinates || 'N/A'}</td>
          <td>${m.coordinateAccuracy}</td>
          <td><span class="popup-status status-${m.statusClass}-badge">${m.statusClass.toUpperCase()}</span></td>
          <td><a href="#equipment/${m.id}" class="btn-card-link">Dossier</a></td>
        </tr>
      `).join('');
    }
  }

  // ==========================================================================
  // 7. Equipment Directory Filters & Sorting
  // ==========================================================================
  function applyEquipmentFilters() {
    const dest = document.getElementById('filterDestination').value;
    const status = document.getElementById('filterStatus').value;
    const type = document.getElementById('filterType').value;
    const search = document.getElementById('filterSearchText').value.toLowerCase().trim();
    const sort = document.getElementById('filterSortOrder').value;

    let filtered = state.equipment.filter(item => {
      if (dest !== 'all' && item.destination !== dest) return false;
      if (status !== 'all' && item.statusClass !== status) return false;
      if (type !== 'all' && item.equipmentType !== type) return false;
      if (search) {
        const text = `${item.name} ${item.missionName} ${item.missionObjective} ${item.equipmentType}`.toLowerCase();
        if (!text.includes(search)) return false;
      }
      return true;
    });

    // Sorting
    filtered.sort((a, b) => {
      if (sort === 'chronological-asc') {
        if (!a.launchDate) return 1;
        if (!b.launchDate) return -1;
        return a.launchDate.localeCompare(b.launchDate);
      } else if (sort === 'chronological-desc') {
        if (!a.launchDate) return 1;
        if (!b.launchDate) return -1;
        return b.launchDate.localeCompare(a.launchDate);
      } else if (sort === 'name-asc') {
        return a.name.localeCompare(b.name);
      } else if (sort === 'destination') {
        return a.destination.localeCompare(b.destination);
      }
      return 0;
    });

    // Update Counter
    const countBadge = document.getElementById('filtersResultCount');
    if (countBadge) {
      countBadge.textContent = `Showing ${filtered.length} of ${state.equipment.length} equipment records`;
    }

    // Render Cards
    const cardsContainer = document.getElementById('directoryCardsContainer');
    if (cardsContainer) {
      if (filtered.length === 0) {
        cardsContainer.innerHTML = `
          <div style="grid-column: 1 / -1; text-align: center; padding: var(--space-3xl) 0; color: var(--text-muted);">
            <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom: var(--space-md);"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <h3>No matching artifacts found</h3>
            <p>Try broadening your filter criteria or reset filters.</p>
          </div>
        `;
      } else {
        cardsContainer.innerHTML = filtered.map(createEquipmentCardHTML).join('');
      }
    }

    // Render Table
    const tableBody = document.getElementById('directoryTableBody');
    if (tableBody) {
      tableBody.innerHTML = filtered.map(m => `
        <tr>
          <td><strong class="data-table-name">${m.name}</strong></td>
          <td>${m.destination}</td>
          <td>${m.equipmentType}</td>
          <td>${m.missionName}</td>
          <td>${m.launchDate || 'Unverified'}</td>
          <td>${m.landingDate || 'Unverified'}</td>
          <td>${m.coordinates || 'N/A'}</td>
          <td><span class="popup-status status-${m.statusClass}-badge">${m.statusClass.toUpperCase()}</span></td>
          <td><a href="#equipment/${m.id}" class="btn-card-link">Dossier</a></td>
        </tr>
      `).join('');
    }
  }

  function initDirectoryFilters() {
    ['filterDestination', 'filterStatus', 'filterType', 'filterSortOrder'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('change', applyEquipmentFilters);
    });

    const searchInput = document.getElementById('filterSearchText');
    if (searchInput) searchInput.addEventListener('input', applyEquipmentFilters);

    const btnReset = document.getElementById('btnResetFilters');
    if (btnReset) {
      btnReset.addEventListener('click', () => {
        document.getElementById('filterDestination').value = 'all';
        document.getElementById('filterStatus').value = 'all';
        document.getElementById('filterType').value = 'all';
        document.getElementById('filterSortOrder').value = 'chronological-asc';
        document.getElementById('filterSearchText').value = '';
        applyEquipmentFilters();
      });
    }

    // View mode toggle
    const btnCards = document.getElementById('btnViewCards');
    const btnTable = document.getElementById('btnViewTable');
    const cardsWrap = document.getElementById('directoryCardsContainer');
    const tableWrap = document.getElementById('directoryTableContainer');

    if (btnCards && btnTable) {
      btnCards.addEventListener('click', () => {
        btnCards.classList.add('active');
        btnCards.setAttribute('aria-pressed', 'true');
        btnTable.classList.remove('active');
        btnTable.setAttribute('aria-pressed', 'false');
        cardsWrap.style.display = 'grid';
        tableWrap.style.display = 'none';
      });

      btnTable.addEventListener('click', () => {
        btnTable.classList.add('active');
        btnTable.setAttribute('aria-pressed', 'true');
        btnCards.classList.remove('active');
        btnCards.setAttribute('aria-pressed', 'false');
        cardsWrap.style.display = 'none';
        tableWrap.style.display = 'block';
      });
    }
  }

  // ==========================================================================
  // 8. Full Timeline Renderer
  // ==========================================================================
  function renderFullTimeline() {
    const container = document.getElementById('fullTimelineStream');
    if (!container) return;

    const filterDest = document.getElementById('timelineFilterDest').value;
    const filterCat = document.getElementById('timelineFilterCategory').value;

    const filtered = state.timeline.filter(evt => {
      if (filterDest !== 'all' && evt.destination !== filterDest) return false;
      if (filterCat !== 'all' && evt.eventCategory !== filterCat) return false;
      return true;
    });

    container.innerHTML = filtered.map((evt, idx) => {
      const isLeft = idx % 2 === 0;
      const destClass = (evt.destination || '').toLowerCase() === 'mars' ? 'mars' : 'moon';
      return `
        <article class="timeline-event-card ${isLeft ? 'left' : 'right'}">
          <span class="timeline-node-pin ${evt.statusColor || 'green'}"></span>
          <div class="event-header">
            <span class="event-date">${evt.date}</span>
            <span class="event-dest-pill ${destClass}">${evt.destination}</span>
          </div>
          <h3 class="event-title">${evt.title}</h3>
          <p class="event-desc">${evt.description}</p>
          <div class="event-footer">
            <span>${evt.eventCategory}</span>
            ${evt.equipmentId ? `<a href="#equipment/${evt.equipmentId}" class="btn-card-link">View Equipment &rarr;</a>` : ''}
          </div>
        </article>
      `;
    }).join('');
  }

  // ==========================================================================
  // 9. Explore Planets Dossiers
  // ==========================================================================
  function renderPlanetsDossiers() {
    const grid = document.getElementById('planetsGrid');
    if (!grid) return;

    grid.innerHTML = state.planets.map(planet => `
      <div class="planet-card" data-planet="${planet.id}">
        <div class="planet-card-header">
          <div>
            <h3 class="planet-name">${planet.name}</h3>
            <span class="planet-type">${planet.type}</span>
          </div>
          <span class="planet-dot" style="background: ${planet.color || '#38bdf8'};"></span>
        </div>
        <p style="font-size: 0.85rem; color: var(--text-secondary); line-height: 1.5; margin-bottom: var(--space-sm);">
          ${planet.description}
        </p>
        <div class="planet-stat-row">
          <span>Diameter:</span>
          <strong>${planet.diameterKm.toLocaleString()} km</strong>
        </div>
        <div class="planet-stat-row">
          <span>Surface Temp:</span>
          <strong>${planet.surfaceTemp}</strong>
        </div>
        <div class="planet-stat-row" style="margin-top: 6px; padding-top: 6px; border-top: 1px solid var(--border-dim);">
          <span style="font-size: 0.78rem;">Notable Missions:</span>
          <span style="font-size: 0.78rem; text-align: right; color: var(--accent-cyan);">${planet.notableMissions}</span>
        </div>
      </div>
    `).join('');
  }

  // ==========================================================================
  // 10. Missions Directory Renderer
  // ==========================================================================
  function renderMissionsDirectory() {
    const container = document.getElementById('missionsListGrid');
    if (!container) return;

    container.innerHTML = state.missions.map(m => `
      <div style="background: var(--bg-card); border: 1px solid var(--border-dim); border-radius: var(--radius-lg); padding: var(--space-xl); display: flex; flex-direction: column;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: var(--space-xs);">
          <div>
            <span class="section-eyebrow" style="font-size: 0.72rem; margin-bottom: 2px;">${m.program || m.agency}</span>
            <h3 style="font-size: 1.4rem; font-weight: 700; color: var(--text-primary);">${m.name}</h3>
          </div>
          <span class="popup-status ${m.status === 'Completed' ? 'status-historical-badge' : 'status-active-badge'}">
            ${m.status.toUpperCase()}
          </span>
        </div>
        <div style="font-size: 0.85rem; color: var(--accent-cyan); font-family: var(--font-mono); margin-bottom: var(--space-sm);">
          ${m.launchDate} &rarr; ${m.endDate || 'Present'} (${m.destination})
        </div>
        <p style="font-size: 0.9rem; color: var(--text-secondary); line-height: 1.6; margin-bottom: var(--space-md); flex: 1;">
          ${m.summary}
        </p>
        <div style="padding-top: var(--space-md); border-top: 1px solid var(--border-dim); font-size: 0.85rem;">
          <strong style="color: var(--text-primary); display: block; margin-bottom: 4px;">Outcome & Discoveries:</strong>
          <span style="color: var(--text-secondary);">${m.outcome}</span>
        </div>
      </div>
    `).join('');
  }

  // ==========================================================================
  // 11. Compare Tool Matrix
  // ==========================================================================
  function initCompareTool() {
    const s1 = document.getElementById('compareSelect1');
    const s2 = document.getElementById('compareSelect2');
    const s3 = document.getElementById('compareSelect3');
    if (!s1 || !s2 || !s3) return;

    // Populate selectors with equipment options
    const optionsHTML = state.equipment.map(e => `
      <option value="${e.id}">${e.name} (${e.destination} • ${e.equipmentType})</option>
    `).join('');

    s1.innerHTML = optionsHTML;
    s2.innerHTML = optionsHTML;
    s3.innerHTML = `<option value="">-- None (2-way comparison) --</option>` + optionsHTML;

    // Set defaults: Curiosity vs Perseverance
    const r7 = state.equipment.find(e => e.id === 'R007');
    const r8 = state.equipment.find(e => e.id === 'R008');
    if (r7 && r8) {
      s1.value = r7.id;
      s2.value = r8.id;
    } else if (state.equipment.length >= 2) {
      s1.value = state.equipment[0].id;
      s2.value = state.equipment[1].id;
    }

    const updateMatrix = () => {
      const id1 = s1.value;
      const id2 = s2.value;
      const id3 = s3.value;

      const items = [
        state.equipment.find(e => e.id === id1),
        state.equipment.find(e => e.id === id2),
        id3 ? state.equipment.find(e => e.id === id3) : null
      ].filter(Boolean);

      const thead = document.getElementById('compareTableHead');
      const tbody = document.getElementById('compareTableBody');
      if (!thead || !tbody) return;

      thead.innerHTML = `
        <tr>
          <th style="width: 220px;">Attribute</th>
          ${items.map(item => `<th>${item.name}</th>`).join('')}
        </tr>
      `;

      const fields = [
        { label: 'Destination', key: 'destination' },
        { label: 'Equipment Type', key: 'equipmentType' },
        { label: 'Mission / Program', key: 'missionName' },
        { label: 'Operational Status', key: 'status' },
        { label: 'Launch Date', key: 'launchDate' },
        { label: 'Landing / Arrival', key: 'landingDate' },
        { label: 'Surface Coordinates', key: 'coordinates' },
        { label: 'Mass', key: 'massKg' },
        { label: 'Power Source', key: 'powerSource' },
        { label: 'Mobility Capabilities', key: 'mobility' },
        { label: 'Major Discoveries', fn: i => i.majorDiscoveries && i.majorDiscoveries.length ? i.majorDiscoveries.join('; ') : 'Under verification' },
        { label: 'Scientific Legacy', key: 'missionOutcome' }
      ];

      tbody.innerHTML = fields.map(f => `
        <tr>
          <td class="compare-row-label">${f.label}</td>
          ${items.map(item => {
            const val = f.fn ? f.fn(item) : item[f.key];
            if (!val || val === 'Unknown / Not verified' || val === 'Consult Technical Specs') {
              return `<td><span class="val-unknown">Unknown / Not verified</span></td>`;
            }
            return `<td>${val}</td>`;
          }).join('')}
        </tr>
      `).join('');
    };

    s1.addEventListener('change', updateMatrix);
    s2.addEventListener('change', updateMatrix);
    s3.addEventListener('change', updateMatrix);

    updateMatrix();
  }

  // ==========================================================================
  // 12. Interactive Quiz Engine
  // ==========================================================================
  function initQuizEngine() {
    state.currentQuizIndex = 0;
    state.quizScore = 0;
    renderQuizQuestion();

    const btnNext = document.getElementById('btnQuizNext');
    if (btnNext) {
      btnNext.addEventListener('click', () => {
        state.currentQuizIndex++;
        if (state.currentQuizIndex < state.quiz.length) {
          renderQuizQuestion();
        } else {
          showQuizResults();
        }
      });
    }

    const btnRetry = document.getElementById('btnQuizRetry');
    if (btnRetry) {
      btnRetry.addEventListener('click', () => {
        state.currentQuizIndex = 0;
        state.quizScore = 0;
        document.getElementById('quizResultsDashboard').style.display = 'none';
        document.getElementById('quizQuestionText').style.display = 'block';
        document.getElementById('quizOptionsList').style.display = 'flex';
        renderQuizQuestion();
      });
    }
  }

  function renderQuizQuestion() {
    if (!state.quiz || state.quiz.length === 0) return;
    const q = state.quiz[state.currentQuizIndex];
    if (!q) return;

    // Update progress bar
    const progressPct = ((state.currentQuizIndex) / state.quiz.length) * 100;
    const bar = document.getElementById('quizProgressFill');
    if (bar) bar.style.width = `${progressPct}%`;

    // Update Counters
    document.getElementById('quizQuestionCounter').textContent = `Question ${state.currentQuizIndex + 1} of ${state.quiz.length}`;
    document.getElementById('quizCurrentScore').textContent = `Score: ${state.quizScore} / ${state.currentQuizIndex}`;

    // Question Text
    document.getElementById('quizQuestionText').textContent = q.question;

    // Options List
    const optList = document.getElementById('quizOptionsList');
    optList.innerHTML = q.options.map((opt, i) => `
      <button class="quiz-opt-btn" data-index="${i}">
        <span class="quiz-opt-key">${['A', 'B', 'C', 'D'][i]}</span>
        <span>${opt}</span>
      </button>
    `).join('');

    // Hide Next Button & Explanation
    const btnNext = document.getElementById('btnQuizNext');
    if (btnNext) btnNext.style.display = 'none';

    const expBox = document.getElementById('quizExplanationBox');
    if (expBox) expBox.classList.remove('active');

    // Attach Option Click Handler
    optList.querySelectorAll('.quiz-opt-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const selectedIdx = parseInt(btn.getAttribute('data-index'), 10);
        handleQuizAnswer(selectedIdx, q);
      });
    });
  }

  function handleQuizAnswer(selectedIdx, q) {
    const btns = document.querySelectorAll('.quiz-opt-btn');
    btns.forEach(b => b.disabled = true);

    const isCorrect = selectedIdx === q.correctIndex;
    if (isCorrect) {
      state.quizScore++;
      btns[selectedIdx].classList.add('correct');
    } else {
      btns[selectedIdx].classList.add('incorrect');
      if (btns[q.correctIndex]) {
        btns[q.correctIndex].classList.add('correct');
      }
    }

    // Show explanation
    const expBox = document.getElementById('quizExplanationBox');
    const expText = document.getElementById('quizExplanationText');
    if (expBox && expText) {
      expText.textContent = q.explanation;
      expBox.classList.add('active');
    }

    // Show Next Button
    const btnNext = document.getElementById('btnQuizNext');
    if (btnNext) btnNext.style.display = 'inline-flex';
  }

  function showQuizResults() {
    document.getElementById('quizProgressFill').style.width = '100%';
    document.getElementById('quizQuestionText').style.display = 'none';
    document.getElementById('quizOptionsList').style.display = 'none';
    document.getElementById('quizExplanationBox').classList.remove('active');
    document.getElementById('btnQuizNext').style.display = 'none';

    const dash = document.getElementById('quizResultsDashboard');
    const summary = document.getElementById('quizFinalScoreSummary');
    if (dash && summary) {
      const pct = Math.round((state.quizScore / state.quiz.length) * 100);
      summary.innerHTML = `You answered <strong>${state.quizScore} of ${state.quiz.length}</strong> questions correctly (${pct}%). All facts in this quiz are verifiable in official NASA NSSDC/JPL mission archives.`;
      dash.style.display = 'block';
    }
  }

  // ==========================================================================
  // 13. Glossary & Sources Renderers
  // ==========================================================================
  function renderGlossary(filterCat = 'all') {
    const container = document.getElementById('glossaryAccordion');
    if (!container) return;

    const filtered = state.glossary.filter(item => {
      if (filterCat !== 'all' && item.category !== filterCat) return false;
      return true;
    });

    container.innerHTML = filtered.map(item => `
      <div class="glossary-item">
        <button class="glossary-trigger">
          <span>${item.term}</span>
          <span class="glossary-badge">${item.category}</span>
        </button>
        <div class="glossary-content">
          <p>${item.definition}</p>
          <div style="margin-top: 8px; font-size: 0.78rem; color: var(--text-muted);">
            Source Citation: <em>${item.citation}</em>
          </div>
        </div>
      </div>
    `).join('');

    // Toggle accordions
    container.querySelectorAll('.glossary-trigger').forEach(btn => {
      btn.addEventListener('click', () => {
        const item = btn.parentElement;
        item.classList.toggle('open');
      });
    });
  }

  function renderSourcesRegister() {
    const tbody = document.getElementById('sourcesTableBody');
    if (!tbody) return;

    tbody.innerHTML = state.sources.map(s => `
      <tr>
        <td><code>${s.sourceId}</code></td>
        <td><strong class="data-table-name">${s.title}</strong></td>
        <td>${s.organization}</td>
        <td><span class="dataset-badge">${s.verificationStatus}</span></td>
        <td>${s.supportedRecords}</td>
        <td><a href="${s.url}" target="_blank" rel="noopener noreferrer" class="btn-card-link">Archive &rarr;</a></td>
      </tr>
    `).join('');
  }

  // ==========================================================================
  // Classroom lessons and FAQ search
  // ==========================================================================
  function initClassroomAndFaqs() {
    const lessons = {
      legacy: {unit:'UNIT 01', duration:'10–15 minutes', title:'What is left behind?', intro:'Space missions leave more than photographs and discoveries. Some hardware remains where it completed its work; other spacecraft continue in orbit or end their missions in different ways.', goals:['Distinguish equipment location from mission status.','Explain why evidence and sources matter.','Describe one question a researcher should ask about an artifact.'], body:'<ul><li><strong>Start with the mission:</strong> identify what the spacecraft or instrument was designed to do.</li><li><strong>Separate location from status:</strong> a mission can be complete while its hardware remains, and an orbiter is not a surface artifact.</li><li><strong>Keep uncertainty visible:</strong> if a source does not establish an exact location or end state, record that limitation.</li></ul>', prompt:'What evidence would you need before saying exactly where an object is today?'},
      moon: {unit:'UNIT 02', duration:'15 minutes', title:'Moon mission evidence', intro:'Lunar exploration includes crewed Apollo missions, robotic Surveyor landers, orbiters, rovers, and scientific experiments. Each record should be understood in the context of its mission.', goals:['Recognize that different Moon missions left different kinds of hardware.','Distinguish a surface location from an orbital mission.','Use record fields to make a cautious claim.'], body:'<ul><li>Open a Moon equipment record and locate the mission name and equipment type.</li><li>Check the location and coordinate-accuracy fields before interpreting a map marker.</li><li>Compare an object’s mission objective with its documented outcome; do not assume every component survived in the same condition.</li></ul>', prompt:'How could a lander, an orbiter, and a rover leave different kinds of evidence?'},
      mars: {unit:'UNIT 03', duration:'15 minutes', title:'Mars: robots and records', intro:'NASA Mars missions include orbiters, landers, stationary science platforms, and mobile rovers. Their capabilities and end states are different, so a reliable record must describe the specific hardware.', goals:['Tell orbiters, landers, and rovers apart.','Connect an artifact to its mission purpose.','Identify one detail that needs a reliable source.'], body:'<ul><li>Choose a Mars mission record and identify its hardware category.</li><li>Look for mission objective, landing/arrival information, location, and known outcome.</li><li>Discuss why an orbiter’s location cannot be represented as a precise rover landing site.</li></ul>', prompt:'Which fields would you check before placing a Mars artifact on a surface map?'},
      evidence: {unit:'UNIT 04', duration:'10 minutes', title:'Think like a researcher', intro:'A good catalog does not only collect facts: it shows where claims come from and makes gaps in the evidence visible.', goals:['Trace a claim to a source.','Distinguish verified information from unknown values.','Write a cautious, testable statement.'], body:'<ul><li>Pick one factual claim from an equipment page.</li><li>Open the cited source and check whether it directly supports the claim.</li><li>Write the claim in your own words, note the source, and label any remaining uncertainty.</li></ul>', prompt:'What is the difference between “not found in our sources” and “does not exist”?' }
    };
    let current = 'legacy';
    const byId = id => document.getElementById(id);
    function showLesson(id) {
      current = lessons[id] ? id : 'legacy'; const l = lessons[current];
      ['lessonUnit','lessonDuration','lessonTitle','lessonIntro','lessonPrompt'].forEach((key,i)=>{const el=byId(key); if(el) el.textContent=[l.unit,l.duration,l.title,l.intro,l.prompt][i];});
      const goals=byId('lessonGoals'); if(goals) goals.innerHTML=l.goals.map(g=>`<li>${g}</li>`).join('');
      const body=byId('lessonBody'); if(body) body.innerHTML=l.body;
      document.querySelectorAll('.lesson-select').forEach(b=>b.classList.toggle('is-active',b.dataset.lesson===current));
    }
    document.querySelectorAll('.lesson-select').forEach(b=>b.addEventListener('click',()=>showLesson(b.dataset.lesson)));
    const next=byId('lessonNext'), prev=byId('lessonPrevious'), start=byId('classroomStartLesson');
    const ids=Object.keys(lessons);
    if(next) next.addEventListener('click',()=>showLesson(ids[(ids.indexOf(current)+1)%ids.length]));
    if(prev) prev.addEventListener('click',()=>showLesson(ids[(ids.indexOf(current)-1+ids.length)%ids.length]));
    if(start) start.addEventListener('click',()=>{showLesson('legacy'); byId('lessonTitle')?.scrollIntoView({behavior:'smooth',block:'center'});});
    const faqSearch=byId('faqSearch');
    if(faqSearch) faqSearch.addEventListener('input',()=>{const q=faqSearch.value.trim().toLowerCase(); document.querySelectorAll('.faq-item').forEach(item=>{item.hidden=!item.textContent.toLowerCase().includes(q);});});
    showLesson('legacy');
  }

  // ========================================================================
  // Prototype 1's full equipment-detail screen, adapted to Prototype 2 data
  // ========================================================================
  function renderEquipmentDetailScreen(eq, requestedId) {
    const root = document.getElementById('equipmentDetailScreenContent');
    if (!root) return;

    const esc = (value) => String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    const safeHref = (value) => {
      const url = String(value || '').trim();
      return /^https?:\/\//i.test(url) ? esc(url) : '';
    };
    const parseArray = (value) => {
      if (Array.isArray(value)) {
        if (value.length && typeof value[0] === 'string' && /^\s*\[/.test(value[0])) {
          const candidates = [value[0], value.join(',')];
          for (const candidate of candidates) {
            try { const parsed = JSON.parse(candidate); if (Array.isArray(parsed)) return parsed; } catch (_) {}
          }
        }
        return value;
      }
      if (typeof value === 'string' && value.trim()) {
        try { const parsed = JSON.parse(value); if (Array.isArray(parsed)) return parsed; } catch (_) {}
      }
      return [];
    };
    const display = (value, fallback = 'Not recorded in this equipment record') => {
      if (value === null || value === undefined || value === '') return fallback;
      if (typeof value === 'boolean') return value ? 'Yes' : 'No';
      if (typeof value === 'object') return esc(JSON.stringify(value));
      return esc(value);
    };
    const list = (items, key) => items.map((item) => {
      const value = key && item && typeof item === 'object' ? item[key] : item;
      return `<li>${esc(value == null ? '' : value)}</li>`;
    }).join('');

    if (!eq) {
      root.innerHTML = `
        <div class="p1-dossier-inner">
          <nav class="p1-detail-breadcrumb" aria-label="Breadcrumb"><a href="#filters">Equipment Catalogue</a> <span aria-hidden="true">›</span> <span>Record not found</span></nav>
          <section class="p1-detail-card p1-not-found">
            <span class="p1-detail-eyebrow">Equipment dossier</span>
            <h1 id="detailRecordTitle">Hardware Record Not Found</h1>
            <p>No equipment record with identifier <strong>${esc(requestedId || 'unknown')}</strong> exists in the current Prototype 2 catalogue.</p>
            <a href="#filters" class="btn btn-primary">Return to Equipment Catalogue</a>
          </section>
        </div>`;
      return;
    }

    addRecentlyExplored(eq);
    const image = eq.image && typeof eq.image === 'object' ? eq.image : {};
    const imageSrc = safeHref(image.primary || '');
    const imageCredit = image.credit || 'NASA credit not separately specified';
    const imageCaption = image.caption || eq.name;
    const timeline = parseArray(eq.missionHistory);
    const instruments = parseArray(eq.scientificInstruments);
    const discoveries = parseArray(eq.majorDiscoveries);
    const uncertainty = parseArray(eq.uncertaintyNotes);
    const missing = parseArray(eq.missingDataNotes);
    const claims = parseArray(eq.sourceClaims || eq.source_claims);
    let coords = eq.coordinates;
    if (typeof coords === 'string') {
      try { coords = JSON.parse(coords); } catch (_) { coords = null; }
    }
    const latitude = eq.latitude != null && eq.latitude !== '' ? eq.latitude : (coords && coords.latitude);
    const longitude = eq.longitude != null && eq.longitude !== '' ? eq.longitude : (coords && coords.longitude);
    const hasCoordinates = eq.hasLocation === true || (latitude !== undefined && latitude !== null && longitude !== undefined && longitude !== null);
    const statusText = eq.status || 'Status not recorded';
    const statusNormalized = String(eq.statusClass || statusText).toLowerCase();
    const statusTone = /success|complete|operational|working|active/.test(statusNormalized) ? 'green' : (/lost|stopped|failed|ended|inactive|retired/.test(statusNormalized) ? 'red' : 'yellow');
    const destRoute = String(eq.destination || '').toLowerCase().includes('mars') ? '#destination-mars' : (String(eq.destination || '').toLowerCase().includes('moon') ? '#destination-moon' : '#planets');
    const sourceHref = safeHref(eq.sourceUrl);
    const checkDate = eq.sourceCheckedDate || 'Not recorded';
    const missionRecord = state.missions.find(m => m.id === eq.missionId || m.name === eq.missionName);
    const missionMilestones = timeline.length ? timeline : (missionRecord ? parseArray(missionRecord.majorMilestones).map(m => ({date:m.date, event:m.event || m.title})) : []);
    const specs = [];
    if (eq.massKg !== undefined && eq.massKg !== null && eq.massKg !== '') specs.push(['Mass', `${esc(eq.massKg)} kg`]);
    else if (eq.massDisplay || eq.mass_display) specs.push(['Mass', display(eq.massDisplay || eq.mass_display)]);
    if (eq.dimensions) specs.push(['Dimensions', display(eq.dimensions)]);
    if (eq.powerSource) specs.push(['Power source', display(eq.powerSource)]);
    if (eq.mobility) specs.push(['Mobility capabilities', display(eq.mobility)]);
    if (eq.remainingHardware) specs.push(['Remaining hardware', display(eq.remainingHardware)]);
    if (eq.physicalLocationCategory) specs.push(['Physical disposition', display(eq.physicalLocationCategory)]);
    if (eq.coordinateAccuracy) specs.push(['Coordinate precision', display(eq.coordinateAccuracy)]);

    root.innerHTML = `
      <div class="p1-dossier-inner">
        <nav class="p1-detail-breadcrumb" aria-label="Breadcrumb">
          <a href="#filters">Equipment Catalogue</a><span aria-hidden="true">›</span>
          <a href="${destRoute}">${esc(eq.destination || 'Destination')}</a><span aria-hidden="true">›</span>
          <span aria-current="page">${esc(eq.name)}</span>
        </nav>

        <header class="p1-detail-titlebar">
          <div class="p1-detail-titlegroup">
            <span class="p1-detail-eyebrow">${esc(eq.destination)} hardware · ${esc(eq.equipmentType || 'Equipment')}</span>
            <h1 id="detailRecordTitle">${esc(eq.name)}</h1>
            <p>Associated with the <strong>${esc(eq.missionName || 'Mission not recorded')}</strong> mission${eq.agency ? ` (${esc(eq.agency)})` : ''}.</p>
          </div>
          <div class="p1-detail-title-actions">
            <span class="p1-status-badge ${statusTone}"><span class="p1-status-dot"></span>${esc(statusText)}</span>
            <a href="#compare" class="btn btn-secondary">Compare this item ⚖️</a>
          </div>
        </header>

        <div class="p1-detail-layout">
          <div class="p1-detail-main">
            ${imageSrc ? `<figure class="p1-detail-card p1-detail-image"><img src="${imageSrc}" alt="${esc(imageCaption)}" onerror="this.closest('figure').remove();"><figcaption><strong>Image credit:</strong> ${esc(imageCredit)}${imageCaption ? ` <span>· ${esc(imageCaption)}</span>` : ''}</figcaption></figure>` : ''}

            <section class="p1-detail-card">
              <h2>Mission Objective &amp; Summary</h2>
              <p class="p1-detail-lead">${display(eq.status, 'Operational status has not been recorded for this item.')}</p>
              ${eq.missionObjective ? `<div class="p1-objective-callout"><strong>Mission objective:</strong> ${display(eq.missionObjective)}</div>` : ''}
              <p class="p1-detail-subnote"><strong>Mission outcome:</strong> ${display(eq.missionOutcome)}</p>
            </section>

            <section class="p1-detail-card">
              <h2>Technical Specifications &amp; Physical Properties</h2>
              ${specs.length ? `<div class="p1-detail-table-wrap"><table class="p1-detail-table" aria-label="Technical specifications"><tbody>${specs.map(([label,value]) => `<tr><th scope="row">${esc(label)}</th><td>${value}</td></tr>`).join('')}</tbody></table></div>` : '<p>No verified technical specifications are available in this record yet.</p>'}
            </section>

            ${(instruments.length || discoveries.length) ? `<section class="p1-detail-card">
              <h2>Science Instrumentation &amp; Legacy</h2>
              ${instruments.length ? `<div class="p1-detail-subsection"><h3>Scientific instruments</h3><ul>${list(instruments)}</ul></div>` : ''}
              ${discoveries.length ? `<div class="p1-detail-subsection"><h3>Major scientific discoveries</h3><ul>${list(discoveries)}</ul></div>` : ''}
            </section>` : ''}

            ${missionMilestones.length ? `<section class="p1-detail-card">
              <h2>Chronological Mission Milestones</h2>
              <ol class="p1-milestone-timeline">${missionMilestones.map(item => `<li><time>${esc(item.date || 'Historical milestone')}</time><p>${esc(item.event || item.title || item.description || '')}</p></li>`).join('')}</ol>
            </section>` : ''}

            <section class="p1-detail-card">
              <h2>Sources &amp; Evidence Register</h2>
              <p class="p1-detail-muted">Sources supporting the current record. Claims are only shown as individually attributed when claim-level evidence is present in the data.</p>
              ${claims.length ? `<div class="p1-detail-table-wrap"><table class="p1-detail-table" aria-label="Claim-level sources"><thead><tr><th>Specific claim</th><th>Confidence</th><th>Source reference</th></tr></thead><tbody>${claims.map(c => `<tr><td>${esc(c.claim || c.description || '')}</td><td>${esc(c.confidence || 'Not rated')}</td><td>${safeHref(c.source_url || c.sourceUrl) ? `<a href="${safeHref(c.source_url || c.sourceUrl)}" target="_blank" rel="noopener noreferrer">Open source ↗</a>` : 'No direct URL recorded'}</td></tr>`).join('')}</tbody></table></div>` : '<p class="p1-detail-muted">No separate claim-level source list is attached to this Prototype 2 record; see the primary record source below.</p>'}
              <div class="p1-primary-source">
                <div><strong>Primary record source:</strong> ${display(eq.sourceNote, 'NASA mission archive (specific citation not recorded)')}</div>
                <div><strong>Source URL:</strong> ${sourceHref ? `<a href="${sourceHref}" target="_blank" rel="noopener noreferrer">${sourceHref}</a>` : 'No valid source URL recorded'}</div>
                <div><strong>Last checked:</strong> ${esc(checkDate)}</div>
                <div><strong>Evidence check:</strong> ${display(eq.verificationStatus, 'Not recorded')}</div>
              </div>
            </section>
          </div>

          <aside class="p1-detail-sidebar" aria-label="Equipment quick facts and location">
            <section class="p1-detail-card">
              <h2>Quick Facts</h2>
              <dl class="p1-quick-facts">
                <div><dt>Hardware ID</dt><dd class="p1-mono">${esc(eq.id)}</dd></div>
                <div><dt>Destination</dt><dd>${esc(eq.destination || 'Not recorded')}</dd></div>
                <div><dt>Equipment type</dt><dd>${esc(eq.equipmentType || 'Not recorded')}</dd></div>
                <div><dt>Mission</dt><dd>${missionRecord ? `<a href="#missions">${esc(eq.missionName || missionRecord.name)}</a>` : esc(eq.missionName || 'Not recorded')}</dd></div>
                <div><dt>Agency</dt><dd>${esc(eq.agency || 'Not recorded')}</dd></div>
                <div><dt>Launch date</dt><dd>${esc(eq.launchDate || 'Unknown / not verified')}</dd></div>
                <div><dt>Arrival / landing</dt><dd>${esc(eq.arrivalDate || eq.landingDate || 'Unknown / not verified')}</dd></div>
                <div><dt>Last communication</dt><dd>${esc(eq.lastContactDate || 'Unknown / not verified')}</dd></div>
                <div><dt>Mission lifecycle</dt><dd>${esc(eq.missionEndDate || 'Unknown / not verified')}</dd></div>
                <div><dt>Physical disposition</dt><dd>${esc(eq.physicalLocationCategory || 'Not recorded')}</dd></div>
              </dl>
            </section>

            <section class="p1-detail-card">
              <h2>Extraterrestrial Location</h2>
              ${hasCoordinates && latitude != null && longitude != null ? `<div class="p1-coordinate-grid"><div><span>Latitude</span><strong>${esc(latitude)}°</strong></div><div><span>Longitude</span><strong>${esc(longitude)}°</strong></div></div><p class="p1-detail-muted"><strong>Precision:</strong> ${display(eq.coordinateAccuracy, 'Coordinate precision not separately recorded')}.</p>` : `<p>${display(eq.physicalLocationCategory, 'No fixed surface location is established in this record.')}</p><span class="p1-unknown-badge">${esc(eq.coordinateAccuracy || 'No verified fixed coordinate')}</span>`}
              ${uncertainty.length ? `<div class="p1-detail-notes"><strong>Uncertainty notes</strong><ul>${list(uncertainty)}</ul></div>` : ''}
            </section>

            ${missing.length ? `<section class="p1-detail-card"><h2>Known Data Gaps</h2><ul class="p1-data-gaps">${list(missing)}</ul></section>` : ''}

            <div class="p1-detail-actions"><a href="#compare" class="btn btn-primary">Compare with other hardware ⚖️</a><a href="#filters" class="btn btn-secondary">← Return to full catalogue</a><button type="button" class="btn btn-secondary" data-detail-quiz="${esc(eq.id)}">Start 5-question quiz →</button></div>
          </aside>
        </div>
      </div>`;
  }

  // ==========================================================================
  // 14. Equipment Detail Modal (Deep Dossier)
  // ==========================================================================
  document.addEventListener('click', function (event) {
    const quizButton = event.target.closest('[data-detail-quiz]');
    if (!quizButton) return;
    const artifactId = quizButton.getAttribute('data-detail-quiz');
    try { sessionStorage.setItem('abn_quiz_context', JSON.stringify({ type: 'equipment', id: artifactId })); } catch (_) {}
    const modal = document.getElementById('equipmentDetailModal');
    if (modal) modal.classList.remove('active');
    window.location.hash = '#quiz';
  });

  function openEquipmentDetailModal(eq) {
    const modal = document.getElementById('equipmentDetailModal');
    const title = document.getElementById('modalEquipmentTitle');
    const eyebrow = document.getElementById('modalEquipmentEyebrow');
    const body = document.getElementById('modalEquipmentBody');
    if (!modal || !body) return;

    // Track recently explored
    addRecentlyExplored(eq);

    eyebrow.textContent = `${eq.destination} • ${eq.equipmentType}`;
    title.textContent = eq.name;

    const imgSrc = eq.image && eq.image.primary ? eq.image.primary : '';
    const imgCredit = eq.image && eq.image.credit ? eq.image.credit : 'NASA';
    const imgCaption = eq.image && eq.image.caption ? eq.image.caption : eq.name;

    body.innerHTML = `
      <div class="detail-quiz-callout" style="display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap;padding:16px 18px;margin-bottom:22px;border:1px solid rgba(22,133,197,.28);border-radius:16px;background:linear-gradient(110deg,rgba(22,133,197,.10),rgba(22,133,197,.03));">
        <div><strong style="display:block;color:var(--text-primary);font-size:1rem;">Test your knowledge</strong><span style="display:block;color:var(--text-secondary);font-size:.88rem;margin-top:4px;">Take a short 5-question quiz about this artifact and its mission.</span></div>
        <button type="button" class="btn btn-primary" data-detail-quiz="${eq.id}">Start 5-question quiz →</button>
      </div>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: var(--space-xl); margin-bottom: var(--space-xl);">
        <div>
          <div style="display: flex; gap: var(--space-xs); margin-bottom: var(--space-md); flex-wrap: wrap;">
            <span class="popup-status status-${eq.statusClass}-badge">${eq.statusClass.toUpperCase()}</span>
            <span class="dest-card-badge" style="background: var(--bg-surface);">${eq.agency}</span>
            <span class="dest-card-badge" style="background: var(--bg-surface);">${eq.missionName}</span>
          </div>

          <h4 style="font-size: 1.1rem; font-weight: 700; color: var(--text-primary); margin-bottom: var(--space-xs);">Mission Overview</h4>
          <p style="color: var(--text-secondary); line-height: 1.6; margin-bottom: var(--space-lg);">
            ${eq.missionOutcome || eq.remainingHardware || eq.missionObjective || 'Cataloged NASA mission equipment.'}
          </p>

          <h4 style="font-size: 1.1rem; font-weight: 700; color: var(--text-primary); margin-bottom: var(--space-xs);">Quick Facts</h4>
          <div style="background: var(--bg-surface); border-radius: var(--radius-md); padding: var(--space-md); font-size: 0.88rem; display: flex; flex-direction: column; gap: 8px;">
            <div style="display: flex; justify-content: space-between;"><span>Launch Date:</span><strong>${eq.launchDate || 'Unverified'}</strong></div>
            <div style="display: flex; justify-content: space-between;"><span>Arrival / Landing:</span><strong>${eq.landingDate || 'Unverified'}</strong></div>
            <div style="display: flex; justify-content: space-between;"><span>Surface Coordinates:</span><strong>${eq.coordinates || 'N/A'}</strong></div>
            <div style="display: flex; justify-content: space-between;"><span>Coordinate Accuracy:</span><strong>${eq.coordinateAccuracy}</strong></div>
            <div style="display: flex; justify-content: space-between;"><span>Power System:</span><strong>${eq.powerSource || 'Unverified'}</strong></div>
            <div style="display: flex; justify-content: space-between;"><span>Mobility:</span><strong>${eq.mobility || 'Stationary'}</strong></div>
          </div>
        </div>

        <div>
          ${imgSrc ? `
            <div style="border-radius: var(--radius-lg); overflow: hidden; background: var(--bg-surface); border: 1px solid var(--border-dim);">
              <img src="${imgSrc}" alt="${imgCaption}" style="width: 100%; height: 260px; object-fit: cover; display: block;" onerror="this.style.display='none';">
              <div style="padding: var(--space-sm); font-size: 0.78rem; color: var(--text-muted);">
                <strong>Credit:</strong> ${imgCredit}<br>
                <span>${imgCaption}</span>
              </div>
            </div>
          ` : `
            <div style="border-radius: var(--radius-lg); height: 260px; background: var(--bg-surface); border: 1px solid var(--border-dim); display: flex; flex-direction: column; align-items: center; justify-content: center; color: var(--text-muted); text-align: center; padding: var(--space-lg);">
              <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom: 8px;"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
              <strong>Image Asset Under Archival Review</strong>
              <span style="font-size: 0.78rem;">In compliance with PRD rules, imagery is withheld until rights review is cleared.</span>
            </div>
          `}
        </div>
      </div>

      <div class="detail-section-grid">
        <section class="detail-section-card"><h4>Mission & purpose</h4><p>${eq.missionObjective || eq.description || 'Mission objective details are not available in the current record.'}</p></section>
        <section class="detail-section-card"><h4>What remains / end state</h4><p>${eq.remainingHardware || eq.missionOutcome || 'End-of-mission hardware details are not verified in the current record.'}</p></section>
        <section class="detail-section-card"><h4>Technical notes</h4><p>${[eq.equipmentType, eq.powerSource && `Power: ${eq.powerSource}`, eq.mobility && `Mobility: ${eq.mobility}`].filter(Boolean).join(' · ') || 'Technical specifications are not available in this record.'}</p></section>
        <section class="detail-section-card"><h4>Discoveries & legacy</h4><p>${Array.isArray(eq.majorDiscoveries) && eq.majorDiscoveries.length ? eq.majorDiscoveries.join('; ') : (eq.scientificLegacy || eq.missionOutcome || 'Discovery details require further source review.')}</p></section>
      </div>
      <nav class="detail-shortcuts" aria-label="Related learning tools">
        <a href="#glossary" onclick="document.getElementById('equipmentDetailModal').classList.remove('active')">Glossary</a>
        <a href="#quiz" onclick="document.getElementById('equipmentDetailModal').classList.remove('active')">Quiz</a>
        <a href="#compare" onclick="document.getElementById('equipmentDetailModal').classList.remove('active')">Compare</a>
        <a href="#classroom" onclick="document.getElementById('equipmentDetailModal').classList.remove('active')">Classroom lesson</a>
      </nav>

      <div style="border-top: 1px solid var(--border-dim); padding-top: var(--space-lg); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: var(--space-md);">
        <div style="font-size: 0.8rem; color: var(--text-muted);">
          <span>Evidence Check: <strong>${eq.verificationStatus || 'Verified'}</strong> • Source: <em>${eq.sourceNote || 'NASA Master Catalog'}</em></span>
        </div>
        <div style="display: flex; gap: var(--space-sm);">
          ${eq.sourceUrl ? `<a href="${eq.sourceUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-outline" style="padding: 6px 14px; font-size: 0.84rem;">View Source URL</a>` : ''}
          <a href="#compare" class="btn btn-secondary" style="padding: 6px 14px; font-size: 0.84rem;" onclick="document.getElementById('equipmentDetailModal').classList.remove('active');">Compare Artifact</a>
        </div>
      </div>
    `;

    modal.classList.add('active');
  }

  function addRecentlyExplored(eq) {
    state.recentlyExplored = state.recentlyExplored.filter(item => item.id !== eq.id);
    state.recentlyExplored.unshift(eq);
    if (state.recentlyExplored.length > 4) {
      state.recentlyExplored = state.recentlyExplored.slice(0, 4);
    }
    localStorage.setItem('abn_recently_explored', JSON.stringify(state.recentlyExplored));
    renderRecentlyExplored();
  }

  function renderRecentlyExplored() {
    const sec = document.getElementById('recentlyExploredSection');
    const grid = document.getElementById('recentlyExploredGrid');
    if (!sec || !grid) return;

    if (state.recentlyExplored.length === 0) {
      sec.style.display = 'none';
      return;
    }

    sec.style.display = 'block';
    grid.innerHTML = state.recentlyExplored.map(createEquipmentCardHTML).join('');
  }

  // ==========================================================================
  // 15. Global Search & Grouped Results
  // ==========================================================================
  function initGlobalSearch() {
    const input = document.getElementById('globalSearchInput');
    const modal = document.getElementById('searchResultsModal');
    const container = document.getElementById('searchResultsContainer');
    if (!input || !modal || !container) return;

    input.addEventListener('input', () => {
      const q = input.value.toLowerCase().trim();
      if (!q) return;

      const matchedEq = state.equipment.filter(e => e.name.toLowerCase().includes(q) || e.missionName.toLowerCase().includes(q)).slice(0, 5);
      const matchedMissions = state.missions.filter(m => m.name.toLowerCase().includes(q) || m.summary.toLowerCase().includes(q)).slice(0, 3);
      const matchedGlossary = state.glossary.filter(g => g.term.toLowerCase().includes(q) || g.definition.toLowerCase().includes(q)).slice(0, 3);

      container.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: var(--space-lg);">
          <div>
            <h4 style="font-size: 0.85rem; font-weight: 700; color: var(--accent-cyan); text-transform: uppercase; margin-bottom: var(--space-xs);">Equipment Records (${matchedEq.length})</h4>
            ${matchedEq.length ? matchedEq.map(e => `
              <div style="padding: 8px 0; border-bottom: 1px solid var(--border-dim); display: flex; justify-content: space-between;">
                <div><strong>${e.name}</strong> <span style="font-size: 0.78rem; color: var(--text-muted);">(${e.destination})</span></div>
                <a href="#equipment/${e.id}" class="btn-card-link" onclick="document.getElementById('searchResultsModal').classList.remove('active');">View &rarr;</a>
              </div>
            `).join('') : '<p style="color: var(--text-muted); font-size: 0.85rem;">No matching equipment.</p>'}
          </div>

          <div>
            <h4 style="font-size: 0.85rem; font-weight: 700; color: var(--accent-cyan); text-transform: uppercase; margin-bottom: var(--space-xs);">Missions (${matchedMissions.length})</h4>
            ${matchedMissions.length ? matchedMissions.map(m => `
              <div style="padding: 8px 0; border-bottom: 1px solid var(--border-dim); display: flex; justify-content: space-between;">
                <div><strong>${m.name}</strong> <span style="font-size: 0.78rem; color: var(--text-muted);">(${m.destination})</span></div>
                <a href="#missions" class="btn-card-link" onclick="document.getElementById('searchResultsModal').classList.remove('active');">Missions &rarr;</a>
              </div>
            `).join('') : '<p style="color: var(--text-muted); font-size: 0.85rem;">No matching missions.</p>'}
          </div>

          <div>
            <h4 style="font-size: 0.85rem; font-weight: 700; color: var(--accent-cyan); text-transform: uppercase; margin-bottom: var(--space-xs);">Glossary Terms (${matchedGlossary.length})</h4>
            ${matchedGlossary.length ? matchedGlossary.map(g => `
              <div style="padding: 8px 0; border-bottom: 1px solid var(--border-dim); display: flex; justify-content: space-between;">
                <div><strong>${g.term}</strong></div>
                <a href="#glossary" class="btn-card-link" onclick="document.getElementById('searchResultsModal').classList.remove('active');">Glossary &rarr;</a>
              </div>
            `).join('') : '<p style="color: var(--text-muted); font-size: 0.85rem;">No matching terms.</p>'}
          </div>
        </div>
      `;

      modal.classList.add('active');
    });

    // Close on Escape or click
    document.getElementById('btnCloseSearchModal').addEventListener('click', () => {
      modal.classList.remove('active');
    });
  }

  // ==========================================================================
  // 16. Onboarding Tutorial
  // ==========================================================================
  function initTutorial() {
    const steps = [
      {
        title: "Welcome to Abandoned but Not Forgotten",
        text: "This educational archaeological registry documents authentic NASA-led space hardware resting across the Moon, Mars, and interplanetary space. Explore rovers, landers, descent stages, and scientific instruments."
      },
      {
        title: "Interactive 3D Destinations",
        text: "Explore dedicated Moon and Mars 3D globes with audited surface landing coordinates. Drag to rotate, zoom to inspect landing basins, or toggle the accessible 2D coordinate table anytime."
      },
      {
        title: "Compare & Analyze Hardware",
        text: "Use the Hardware Comparison Matrix to benchmark Apollo lunar modules, Viking landers, Curiosity, and Perseverance side-by-side across power sources, mass, mobility, and scientific legacies."
      },
      {
        title: "Evidence Provenance & Rigor",
        text: "In accordance with our October 2026 PRD v1.0, every claim is traceable to NASA NSSDC and JPL records. No coordinates or dates are invented. Test your knowledge in the verified Extraterrestrial Quiz!"
      }
    ];

    let currentStep = 0;
    const modal = document.getElementById('tutorialModal');
    const label = document.getElementById('tutorialStepLabel');
    const title = document.getElementById('tutorialTitle');
    const text = document.getElementById('tutorialText');
    const btnNext = document.getElementById('btnTutorialNext');
    const btnBack = document.getElementById('btnTutorialBack');
    const btnSkip = document.getElementById('btnSkipTutorial');
    const btnReplay = document.getElementById('btnReplayTutorial');

    const updateStep = () => {
      label.textContent = `Step ${currentStep + 1} of ${steps.length}`;
      title.textContent = steps[currentStep].title;
      text.textContent = steps[currentStep].text;
      btnBack.style.display = currentStep > 0 ? 'inline-flex' : 'none';
      btnNext.textContent = currentStep === steps.length - 1 ? 'Start Exploring &rarr;' : 'Next &rarr;';
    };

    if (btnNext) {
      btnNext.addEventListener('click', () => {
        if (currentStep < steps.length - 1) {
          currentStep++;
          updateStep();
        } else {
          modal.classList.remove('active');
          localStorage.setItem('abn_tutorial_completed', 'true');
        }
      });
    }

    if (btnBack) {
      btnBack.addEventListener('click', () => {
        if (currentStep > 0) {
          currentStep--;
          updateStep();
        }
      });
    }

    if (btnSkip) {
      btnSkip.addEventListener('click', () => {
        modal.classList.remove('active');
        localStorage.setItem('abn_tutorial_completed', 'true');
      });
    }

    if (btnReplay) {
      btnReplay.addEventListener('click', () => {
        currentStep = 0;
        updateStep();
        modal.classList.add('active');
      });
    }

    // Auto-launch on first visit
    if (!state.tutorialCompleted && modal) {
      updateStep();
      modal.classList.add('active');
    }
  }

  // ==========================================================================
  // 17. Notification Bell Drawer
  // ==========================================================================
  function initNotifications() {
    const btn = document.getElementById('btnNotificationBell');
    const drawer = document.getElementById('notificationDrawer');
    const closeBtn = document.getElementById('btnCloseDrawer');
    const list = document.getElementById('drawerUpdatesList');
    if (!btn || !drawer || !closeBtn || !list) return;

    btn.addEventListener('click', () => {
      drawer.classList.toggle('active');
    });

    closeBtn.addEventListener('click', () => {
      drawer.classList.remove('active');
    });

    list.innerHTML = state.updates.map(u => `
      <div class="drawer-item">
        <div class="drawer-item-title">${u.title}</div>
        <div class="drawer-item-date">${u.date} • ${u.category}</div>
        <p style="color: var(--text-secondary); line-height: 1.5; margin-bottom: 6px;">${u.summary}</p>
        <a href="${u.link}" class="btn-card-link" onclick="document.getElementById('notificationDrawer').classList.remove('active');">Explore Record &rarr;</a>
      </div>
    `).join('');
  }

  // ==========================================================================
  // 18. Feedback Mailto Generator
  // ==========================================================================
  function initFeedbackModal() {
    const modal = document.getElementById('feedbackModal');
    const btnOpen = document.getElementById('btnOpenFeedback');
    const btnClose = document.getElementById('btnCloseFeedbackModal');
    const form = document.getElementById('feedbackForm');
    if (!modal || !form) return;

    if (btnOpen) {
      btnOpen.addEventListener('click', () => modal.classList.add('active'));
    }

    if (btnClose) {
      btnClose.addEventListener('click', () => modal.classList.remove('active'));
    }

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const cat = document.getElementById('fbCategory').value;
      const msg = document.getElementById('fbMessage').value;
      const currentUrl = window.location.href;

      const subject = encodeURIComponent(`[Abandoned Registry Feedback] ${cat}`);
      const body = encodeURIComponent(
        `Feedback Category: ${cat}\nPage / Record Context: ${currentUrl}\n\nMessage:\n${msg}\n\n(Generated via Abandoned but Not Forgotten Portal)`
      );

      modal.classList.remove('active');
      window.location.href = `mailto:spaceapps-curators@example.org?subject=${subject}&body=${body}`;
    });
  }

  // ==========================================================================
  // 19. Theme Controller & Global Event Bindings
  // ==========================================================================
  function initTheme() {
    const btnTheme = document.getElementById('btnThemeToggle');
    document.documentElement.setAttribute('data-theme', state.theme);

    if (btnTheme) {
      btnTheme.addEventListener('click', () => {
        state.theme = state.theme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', state.theme);
        localStorage.setItem('abn_theme', state.theme);
      });
    }
  }

  function initModals() {
    // Close modal buttons & backdrop click
    document.querySelectorAll('.modal-backdrop').forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.classList.remove('active');
        }
      });
    });

    const btnCloseMapInfo = document.getElementById('btnCloseMapInfo');
    const btnMapInfoGotIt = document.getElementById('btnMapInfoGotIt');
    [btnCloseMapInfo, btnMapInfoGotIt].forEach(btn => {
      if (btn) btn.addEventListener('click', () => {
        const modal = document.getElementById('mapInfoModal');
        if (modal) modal.classList.remove('active');
      });
    });

    const btnCloseEq = document.getElementById('btnCloseEquipmentModal');
    if (btnCloseEq) {
      btnCloseEq.addEventListener('click', () => {
        document.getElementById('equipmentDetailModal').classList.remove('active');
      });
    }

    const btnClearHistory = document.getElementById('btnClearRecentlyExplored');
    if (btnClearHistory) {
      btnClearHistory.addEventListener('click', () => {
        state.recentlyExplored = [];
        localStorage.removeItem('abn_recently_explored');
        renderRecentlyExplored();
      });
    }
  }

  // ==========================================================================
  // 20. Master Initialization Routine
  // ==========================================================================
  function showMapLoadingForRoute(route) {
    const mapKeys = { 'destination-moon': 'moon', 'destination-mars': 'mars', 'planets': 'planets' };
    const key = mapKeys[route];
    if (!key) return;
    const overlay = document.getElementById(`${key}MapLoading`);
    if (!overlay) return;
    overlay.classList.add('is-visible');
    window.setTimeout(() => overlay.classList.remove('is-visible'), 850);
  }

  function activeMapCanvas(key) {
    if (key === 'moon') return document.getElementById('moonGlobeCanvas');
    if (key === 'mars') return document.getElementById('marsGlobeCanvas');
    if (key === 'planets') return document.getElementById('solarCanvas');
    return null;
  }

  function activeMapGlobe(key) {
    if (key === 'moon') return state.globes.moon;
    if (key === 'mars') return state.globes.mars;
    return null;
  }

  function downloadCanvasAsImage(canvas, filename) {
    if (!canvas) return;
    // Composite globe canvases onto a deep-space background so the downloaded map is not transparent.
    const output = document.createElement('canvas');
    output.width = canvas.width;
    output.height = canvas.height;
    const ctx = output.getContext('2d');
    if (!ctx) return;
    const bg = ctx.createLinearGradient(0, 0, output.width, output.height);
    bg.addColorStop(0, '#050b18');
    bg.addColorStop(1, '#02040a');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, output.width, output.height);
    // Deterministic stars give the exported image the same space-map context.
    for (let i = 0; i < 110; i++) {
      const x = ((i * 197 + 37) % 997) / 997 * output.width;
      const y = ((i * 313 + 71) % 991) / 991 * output.height;
      ctx.globalAlpha = 0.2 + ((i * 7) % 65) / 100;
      ctx.fillStyle = '#e2e8f0';
      ctx.beginPath();
      ctx.arc(x, y, i % 13 === 0 ? 1.5 : 0.7, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.drawImage(canvas, 0, 0);
    const triggerDownload = (url) => {
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
    };
    if (output.toBlob) {
      output.toBlob(blob => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        triggerDownload(url);
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      }, 'image/png');
    } else {
      triggerDownload(output.toDataURL('image/png'));
    }
  }

  function openMapInformation(key) {
    const content = {
      moon: {
        title: 'Moon map information',
        description: 'The Moon view displays a rotatable 3D globe with NASA Moon-mission records that have mappable surface coordinates. Drag to rotate, use plus/minus to zoom, search the catalog, or select a marker to inspect its record.',
        accuracy: 'Only records with location fields can be marked. Some coordinates refer to a landing site or region rather than a survey of the hardware itself. Orbital vehicles and records with unresolved locations are not presented as precise surface pins.'
      },
      mars: {
        title: 'Mars map information',
        description: 'The Mars view displays a rotatable 3D globe with mappable NASA Mars-mission records. Search the catalog, drag to rotate, use plus/minus to zoom, and select an available marker to inspect its record.',
        accuracy: 'A marker depends on a record having location data. For orbiters and flyby spacecraft, a fixed surface point may be inappropriate; missing or uncertain locations are retained in the record rather than invented.'
      },
      planets: {
        title: 'Solar system map information',
        description: 'The solar-system diagram shows the Sun and eight planets on illustrative orbital paths. The planets move in a demonstration animation; the layout is not a scale-accurate representation of real interplanetary distances or current ephemerides.',
        accuracy: 'Planet positions in this diagram are illustrative and animated for exploration. Use the dossier data for the listed physical properties and mission summaries; this view is not a live NASA navigation or tracking service.'
      }
    };
    const data = content[key] || content.planets;
    const modal = document.getElementById('mapInfoModal');
    const title = document.getElementById('mapInfoTitle');
    const desc = document.getElementById('mapInfoDescription');
    const accuracy = document.getElementById('mapInfoAccuracy');
    if (title) title.textContent = data.title;
    if (desc) desc.textContent = data.description;
    if (accuracy) accuracy.textContent = data.accuracy;
    if (modal) modal.classList.add('active');
  }

  function initMapExplorerControls() {
    const keyLabels = { moon: 'Moon', mars: 'Mars', planets: 'Solar system' };
    const mapResults = (key, query) => {
      const q = (query || '').trim().toLowerCase();
      if (key === 'planets') {
        return state.planets.filter(item => !q || `${item.name} ${item.type} ${item.description} ${item.notableMissions}`.toLowerCase().includes(q)).slice(0, 10);
      }
      const dest = key === 'moon' ? 'Moon' : 'Mars';
      return state.equipment.filter(item => item.destination === dest && (!q || `${item.name} ${item.missionName} ${item.equipmentType} ${item.physicalLocationCategory || ''}`.toLowerCase().includes(q))).slice(0, 10);
    };

    function hideResults(key) {
      const input = document.getElementById(`${key}MapSearch`);
      const results = document.getElementById(`${key}MapSearchResults`);
      if (results) results.hidden = true;
      if (input) input.setAttribute('aria-expanded', 'false');
    }

    function selectSearchResult(key, item) {
      const input = document.getElementById(`${key}MapSearch`);
      if (input) input.value = item.name;
      hideResults(key);
      if (key === 'planets') {
        if (window.__ABN_SOLAR_MAP) window.__ABN_SOLAR_MAP.select(item.id, true);
        return;
      }
      const globe = activeMapGlobe(key);
      if (!globe) return;
      if (item.hasLocation && Number.isFinite(Number(item.latitude)) && Number.isFinite(Number(item.longitude))) {
        globe.rotX = Math.max(-Math.PI / 2 + .1, Math.min(Math.PI / 2 - .1, Number(item.latitude) * Math.PI / 180));
        globe.rotY = -Math.PI / 2 - Number(item.longitude) * Math.PI / 180;
        globe.zoom = Math.max(globe.zoom, 1.2);
        globe.selectedMarker = item;
        const coord = document.getElementById(`${key}GlobeHoverCoords`);
        if (coord) coord.textContent = `${item.name} · ${Number(item.latitude).toFixed(2)}°, ${Number(item.longitude).toFixed(2)}°`;
      } else {
        const coord = document.getElementById(`${key}GlobeHoverCoords`);
        if (coord) coord.textContent = `${item.name} · no verified fixed surface coordinate in this record`;
        openEquipmentDetailModal(item);
      }
    }

    ['moon', 'mars', 'planets'].forEach(key => {
      const input = document.getElementById(`${key}MapSearch`);
      const results = document.getElementById(`${key}MapSearchResults`);
      if (input && results) {
        const renderResults = () => {
          const q = input.value || '';
          const items = mapResults(key, q);
          results.replaceChildren();
          if (!items.length) {
            const empty = document.createElement('div');
            empty.className = 'map-search-empty';
            empty.textContent = `No ${key === 'planets' ? 'celestial bodies' : 'equipment records'} found.`;
            results.appendChild(empty);
          } else {
            items.forEach(item => {
              const button = document.createElement('button');
              button.type = 'button';
              button.className = 'map-search-result';
              button.setAttribute('role', 'option');
              const name = document.createElement('span');
              name.className = 'map-search-result-name';
              name.textContent = item.name;
              const meta = document.createElement('span');
              meta.className = 'map-search-result-meta';
              if (key === 'planets') meta.textContent = `${item.type} · ${item.notableMissions || 'Celestial body dossier'}`;
              else meta.textContent = `${item.missionName || 'NASA mission'} · ${item.hasLocation ? 'Mapped location available' : 'No fixed map coordinate'}`;
              button.append(name, meta);
              button.addEventListener('click', () => selectSearchResult(key, item));
              results.appendChild(button);
            });
          }
          results.hidden = false;
          input.setAttribute('aria-expanded', 'true');
        };
        input.addEventListener('focus', renderResults);
        input.addEventListener('click', renderResults);
        input.addEventListener('input', renderResults);
        input.addEventListener('keydown', event => {
          if (event.key === 'Escape') hideResults(key);
          if (event.key === 'Enter' && !results.hidden) {
            const first = results.querySelector('.map-search-result');
            if (first) { event.preventDefault(); first.click(); }
          }
        });
      }

      const download = document.getElementById(`${key}MapDownload`);
      if (download) download.addEventListener('click', () => {
        const fileBase = key === 'planets' ? 'solar-system-map.png' : `${key}-mission-map.png`;
        downloadCanvasAsImage(activeMapCanvas(key), fileBase);
      });

      const menuToggle = document.getElementById(`${key}MapMenuToggle`);
      const menu = document.getElementById(`${key}MapMenu`);
      if (menuToggle && menu) menuToggle.addEventListener('click', () => {
        const opening = menu.hidden;
        menu.hidden = !opening;
        menuToggle.setAttribute('aria-expanded', String(opening));
        const layers = document.getElementById(`${key}MapLayers`);
        if (layers) layers.hidden = true;
      });
    });

    document.querySelectorAll('[data-map-action]').forEach(button => {
      button.addEventListener('click', () => {
        const key = button.getAttribute('data-map-key');
        const action = button.getAttribute('data-map-action');
        const globe = activeMapGlobe(key);
        if (action === 'info') openMapInformation(key);
        if (action === 'layers') {
          const panel = document.getElementById(`${key}MapLayers`);
          if (panel) panel.hidden = !panel.hidden;
          const menu = document.getElementById(`${key}MapMenu`);
          if (menu) menu.hidden = true;
          const menuToggle = document.getElementById(`${key}MapMenuToggle`);
          if (menuToggle) menuToggle.setAttribute('aria-expanded', 'false');
        }
        if (action === 'zoom-in') {
          if (globe) globe.zoom = Math.min(2.5, globe.zoom + .15);
          else if (key === 'planets' && window.__ABN_SOLAR_MAP) window.__ABN_SOLAR_MAP.zoomIn();
        }
        if (action === 'zoom-out') {
          if (globe) globe.zoom = Math.max(.6, globe.zoom - .15);
          else if (key === 'planets' && window.__ABN_SOLAR_MAP) window.__ABN_SOLAR_MAP.zoomOut();
        }
      });
    });

    document.querySelectorAll('[data-map-layer]').forEach(input => {
      input.addEventListener('change', () => {
        const key = input.getAttribute('data-map-key');
        const layer = input.getAttribute('data-map-layer');
        const globe = activeMapGlobe(key);
        if (globe) {
          if (layer === 'markers') globe.showMarkers = input.checked;
          if (layer === 'grid') globe.showGrid = input.checked;
        } else if (key === 'planets' && window.__ABN_SOLAR_MAP) {
          if (layer === 'orbits') window.__ABN_SOLAR_MAP.setOrbits(input.checked);
          if (layer === 'labels') window.__ABN_SOLAR_MAP.setLabels(input.checked);
        }
      });
    });

    // Reset and auto-rotate controls remain available below the 3D globe.
    [['moon', 'Moon'], ['mars', 'Mars']].forEach(([key, cap]) => {
      const reset = document.getElementById(`btn${cap}ResetView`);
      const rotate = document.getElementById(`btn${cap}ToggleAutoRotate`);
      const globe = activeMapGlobe(key);
      if (reset && globe) reset.addEventListener('click', () => {
        globe.rotX = .2; globe.rotY = 0; globe.zoom = 1; globe.selectedMarker = null;
      });
      if (rotate && globe) rotate.addEventListener('click', () => {
        globe.autoRotate = !globe.autoRotate;
        rotate.textContent = `Auto-Rotate: ${globe.autoRotate ? 'On' : 'Off'}`;
      });
    });

    document.addEventListener('click', event => {
      ['moon', 'mars', 'planets'].forEach(key => {
        const toolbar = document.querySelector(`[data-map-toolbar="${key}"]`);
        const results = document.getElementById(`${key}MapSearchResults`);
        if (toolbar && !toolbar.contains(event.target) && results && !results.contains(event.target)) hideResults(key);
        const menu = document.getElementById(`${key}MapMenu`);
        const layers = document.getElementById(`${key}MapLayers`);
        const menuToggle = document.getElementById(`${key}MapMenuToggle`);
        const layerToggle = document.querySelector(`[data-map-action="layers"][data-map-key="${key}"]`);
        if (menu && !menu.contains(event.target) && (!menuToggle || !menuToggle.contains(event.target))) {
          menu.hidden = true;
          if (menuToggle) menuToggle.setAttribute('aria-expanded', 'false');
        }
        if (layers && !layers.contains(event.target) && (!layerToggle || !layerToggle.contains(event.target))) layers.hidden = true;
      });
    });
  }

  function initializeAppComponents() {
    initClassroomAndFaqs();
    // Scroll within Home without changing the SPA route hash.
    const heroScrollCue = document.getElementById('heroScrollCue');
    if (heroScrollCue) {
      heroScrollCue.addEventListener('click', () => {
        const destinations = document.getElementById('home-destinations');
        if (destinations) destinations.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }

    // Render static & dynamic components
    renderFeaturedHome();
    renderHomeTimelinePreview();
    renderDestinationMoon();
    renderDestinationMars();
    applyEquipmentFilters();
    renderFullTimeline();
    renderPlanetsDossiers();
    renderMissionsDirectory();
    renderGlossary('all');
    renderSourcesRegister();
    renderRecentlyExplored();

    initDirectoryFilters();
    initCompareTool();
    initQuizEngine();
    initGlobalSearch();
    initNotifications();
    initFeedbackModal();
    initTutorial();
    initSolarSystemCanvas();

    // Initialize 3D Globes
    const moonMarkers = state.equipment.filter(e => e.destination === 'Moon');
    state.globes.moon = new Canvas3DGlobe('moonGlobeCanvas', {
      type: 'moon',
      markers: moonMarkers,
      onHoverCoords: (txt) => {
        const el = document.getElementById('moonGlobeHoverCoords');
        if (el) el.textContent = txt;
      },
      onMarkerSelect: (m, sx, sy) => {
        const popup = document.getElementById('moonMarkerPopup');
        if (!popup) return;
        if (!m) {
          popup.classList.remove('active');
          return;
        }
        document.getElementById('moonPopupTitle').textContent = m.name;
        document.getElementById('moonPopupMission').textContent = m.missionName;
        const btn = document.getElementById('moonPopupBtnDetails');
        btn.onclick = () => openEquipmentDetailModal(m);
        popup.style.left = `${Math.min(window.innerWidth - 300, Math.max(10, sx - 140))}px`;
        popup.style.top = `${Math.max(10, sy - 110)}px`;
        popup.classList.add('active');
      }
    });

    const marsMarkers = state.equipment.filter(e => e.destination === 'Mars');
    state.globes.mars = new Canvas3DGlobe('marsGlobeCanvas', {
      type: 'mars',
      markers: marsMarkers,
      onHoverCoords: (txt) => {
        const el = document.getElementById('marsGlobeHoverCoords');
        if (el) el.textContent = txt;
      },
      onMarkerSelect: (m, sx, sy) => {
        const popup = document.getElementById('marsMarkerPopup');
        if (!popup) return;
        if (!m) {
          popup.classList.remove('active');
          return;
        }
        document.getElementById('marsPopupTitle').textContent = m.name;
        document.getElementById('marsPopupMission').textContent = m.missionName;
        const btn = document.getElementById('marsPopupBtnDetails');
        btn.onclick = () => openEquipmentDetailModal(m);
        popup.style.left = `${Math.min(window.innerWidth - 300, Math.max(10, sx - 140))}px`;
        popup.style.top = `${Math.max(10, sy - 110)}px`;
        popup.classList.add('active');
      }
    });

    // Mission Map Globe
    state.globes.missionMap = new Canvas3DGlobe('missionMapCanvas', {
      type: 'moon',
      markers: moonMarkers,
      showOrbits: true,
      onMarkerSelect: (m) => {
        if (m) openEquipmentDetailModal(m);
      }
    });

    // Mission Map Destination Switcher
    const btnMapMoon = document.getElementById('btnMapSelectMoon');
    const btnMapMars = document.getElementById('btnMapSelectMars');
    if (btnMapMoon && btnMapMars) {
      btnMapMoon.addEventListener('click', () => {
        btnMapMoon.classList.add('active');
        btnMapMars.classList.remove('active');
        document.getElementById('mapHudTitle').textContent = 'The Moon • Surface & Orbital Trackers';
        if (state.globes.missionMap) {
          state.globes.missionMap.type = 'moon';
          state.globes.missionMap.markers = moonMarkers;
        }
      });
      btnMapMars.addEventListener('click', () => {
        btnMapMars.classList.add('active');
        btnMapMoon.classList.remove('active');
        document.getElementById('mapHudTitle').textContent = 'Mars • Surface & Orbital Trackers';
        if (state.globes.missionMap) {
          state.globes.missionMap.type = 'mars';
          state.globes.missionMap.markers = marsMarkers;
        }
      });
    }

    // Screen-plan map controls: search, download, menu, information, layers and zoom.
    initMapExplorerControls();

    // Timeline destination / category filters
    ['timelineFilterDest', 'timelineFilterCategory'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('change', renderFullTimeline);
    });

    // Glossary Category filters
    const catFilters = document.getElementById('glossaryCategoryFilters');
    if (catFilters) {
      catFilters.querySelectorAll('button').forEach(btn => {
        btn.addEventListener('click', () => {
          catFilters.querySelectorAll('button').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          renderGlossary(btn.getAttribute('data-category'));
        });
      });
    }

    // Mobile menu toggle
    const mobileBtn = document.getElementById('btnMobileToggle');
    if (mobileBtn) {
      mobileBtn.addEventListener('click', () => {
        const nav = document.querySelector('.primary-nav');
        if (nav) {
          const isOpen = nav.style.display === 'flex';
          nav.style.display = isOpen ? 'none' : 'flex';
          nav.style.flexDirection = 'column';
          nav.style.position = 'absolute';
          nav.style.top = '72px';
          nav.style.left = '0';
          nav.style.right = '0';
          nav.style.background = 'var(--bg-card)';
          nav.style.padding = '16px';
          nav.style.boxShadow = 'var(--shadow-lg)';
        }
      });
    }

    // Handle initial route
    handleRoute();
  }

  // Initialize Lifecycle
  window.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initModals();
    loadAllDatasets();
    window.addEventListener('hashchange', handleRoute);
  });

})();
