/**
 * Mission Menu UI — press M to open, shows available missions, select to start.
 */
export class MissionMenu {
  constructor() {
    this.visible = false;
    this.missions = [];
    this._build();
  }

  _build() {
    // Overlay container
    this.container = document.createElement('div');
    this.container.id = 'mission-menu';
    this.container.style.cssText = `
      display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(0,0,0,0.75); z-index: 200; justify-content: center; align-items: center;
      font-family: monospace;
    `;

    // Menu panel
    this.panel = document.createElement('div');
    this.panel.style.cssText = `
      background: rgba(20,20,30,0.95); border: 1px solid #ffaa44; border-radius: 8px;
      padding: 24px; max-width: 500px; width: 90%; max-height: 80vh; overflow-y: auto;
    `;
    this.container.appendChild(this.panel);

    // Header
    const header = document.createElement('div');
    header.style.cssText = 'color: #ffaa44; font-size: 18px; margin-bottom: 16px; text-transform: uppercase; letter-spacing: 2px;';
    header.textContent = 'MISSIONS';
    this.panel.appendChild(header);
    this.header = header;

    // Mission list
    this.list = document.createElement('div');
    this.list.style.cssText = 'display: flex; flex-direction: column; gap: 8px;';
    this.panel.appendChild(this.list);

    // Close hint
    const hint = document.createElement('div');
    hint.style.cssText = 'color: #666; font-size: 11px; margin-top: 16px; text-align: center;';
    hint.textContent = 'Press M to close  |  Press 1-5 to select mission';
    this.panel.appendChild(hint);

    document.body.appendChild(this.container);
  }

  refresh(missions, activeMission, completedIds) {
    this.missions = missions;
    this.list.innerHTML = '';

    const allMissions = Object.values(missions);
    let idx = 1;

    for (const m of allMissions) {
      const card = document.createElement('div');
      const isActive = activeMission && activeMission.id === m.id;
      const isCompleted = completedIds.includes(m.id);
      const isLocked = m.state === 'locked';

      let statusColor = '#666';
      let statusText = 'LOCKED';
      if (isActive) { statusColor = '#44ffaa'; statusText = 'ACTIVE'; }
      else if (isCompleted) { statusColor = '#44aa44'; statusText = 'COMPLETED'; }
      else if (m.state === 'available') { statusColor = '#ffaa44'; statusText = `[${idx}] START`; }

      card.style.cssText = `
        background: rgba(255,255,255,0.05); border: 1px solid ${statusColor}; border-radius: 4px;
        padding: 12px 16px; cursor: ${isLocked ? 'default' : 'pointer'};
        opacity: ${isLocked ? 0.4 : 1};
      `;

      card.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="color:#fff;font-size:14px;font-weight:bold;">${m.title}</span>
          <span style="color:${statusColor};font-size:11px;">${statusText}</span>
        </div>
        <div style="color:#999;font-size:11px;margin-top:4px;">${m.description}</div>
        <div style="color:#ffaa44;font-size:11px;margin-top:4px;">$${m.rewardMoney} reward</div>
      `;

      if (m.state === 'available' && !isActive && !isCompleted) {
        card.onclick = () => this._selectMission(m.id);
        idx++;
      }

      this.list.appendChild(card);
    }
  }

  _selectMission(missionId) {
    if (this.onStart) this.onStart(missionId);
  }

  show(missionManager) {
    this.visible = true;
    this.container.style.display = 'flex';
    this.refresh(missionManager.missions, missionManager.activeMission, missionManager.completed);
  }

  hide() {
    this.visible = false;
    this.container.style.display = 'none';
  }

  toggle(missionManager) {
    if (this.visible) this.hide();
    else this.show(missionManager);
  }
}
