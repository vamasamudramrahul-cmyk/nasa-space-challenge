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
    theme: localStorage.getItem('abn_theme') || 'dark',
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

    // Hide all view sections
    document.querySelectorAll('.view-section').forEach(sec => sec.classList.remove('active'));

    // If detail route, open equipment modal and keep home/filters active underneath
    if (route === 'equipment-detail' && param) {
      const eq = state.equipment.find(item => item.id === param);
      if (eq) {
        openEquipmentDetailModal(eq);
      }
      return;
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
        'glossary': 'Glossary',
        'sources': 'Sources & Evidence',
        'about': 'About & Scope'
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
      this.canvas.width = this.width * dpr;
      this.canvas.height = this.height * dpr;
      this.ctx.scale(dpr, dpr);
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
      this.markers.forEach(m => {
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

    function render() {
      const w = canvas.width;
      const h = canvas.height;
      const cx = w / 2;
      const cy = h / 2;

      ctx.clearRect(0, 0, w, h);

      // Sun at Center
      const sunGrad = ctx.createRadialGradient(cx, cy, 10, cx, cy, 32);
      sunGrad.addColorStop(0, '#fef08a');
      sunGrad.addColorStop(0.5, '#f59e0b');
      sunGrad.addColorStop(1, 'rgba(217, 119, 6, 0.1)');
      ctx.beginPath();
      ctx.arc(cx, cy, 28, 0, Math.PI * 2);
      ctx.fillStyle = sunGrad;
      ctx.fill();

      // Sun Label
      ctx.font = '700 12px system-ui';
      ctx.fillStyle = '#fef08a';
      ctx.textAlign = 'center';
      ctx.fillText('SUN', cx, cy + 4);

      // Render 8 Planets
      const planetsList = state.planets.filter(p => p.id !== 'sun');
      const baseDistances = [55, 90, 135, 185, 255, 335, 415, 490];
      const orbitSpeeds = [4.1, 1.6, 1.0, 0.53, 0.084, 0.034, 0.012, 0.006];

      planetsList.forEach((planet, idx) => {
        const orbitRadius = baseDistances[idx] || (60 + idx * 50);
        const speed = orbitSpeeds[idx] || 0.1;
        const currentAngle = angleOffset * speed * 0.4 + idx * 0.8;

        // Draw Orbit Path
        ctx.beginPath();
        ctx.arc(cx, cy, orbitRadius, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 5]);
        ctx.stroke();
        ctx.setLineDash([]);

        // Planet Position
        const px = cx + Math.cos(currentAngle) * orbitRadius;
        const py = cy + Math.sin(currentAngle) * orbitRadius;
        const planetSize = Math.max(4, Math.min(14, planet.diameterKm / 12000));

        // Planet Body
        ctx.beginPath();
        ctx.arc(px, py, planetSize, 0, Math.PI * 2);
        ctx.fillStyle = planet.color || '#38bdf8';
        ctx.fill();

        // Planet Label
        ctx.font = '600 11px system-ui';
        ctx.fillStyle = '#94a3b8';
        ctx.textAlign = 'center';
        ctx.fillText(planet.name, px, py - planetSize - 4);
      });

      if (!state.solarPaused) {
        angleOffset += 0.015;
      }
      requestAnimationFrame(render);
    }

    render();

    // Pause / Resume Button
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
  // 14. Equipment Detail Modal (Deep Dossier)
  // ==========================================================================
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
  function initializeAppComponents() {
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
