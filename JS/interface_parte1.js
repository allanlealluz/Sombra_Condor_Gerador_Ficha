
function esc(s) {
    return String(s ?? '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// --- RENDERIZADORES DE INTERFACE (SIDEBAR) ---

function refreshAll() {
    ensureSchema();   
    setupModals();    
    renderGroupTree();
    renderMissionList();
    renderScriptList();
}

function renderGroupTree() {
    const container = document.getElementById('groupsRoot');
    const rows = DBSystem.exec("SELECT id, parent_id, name, type, image FROM groups ORDER BY name ASC");
    if (rows.length === 0) { container.innerHTML = ''; return; }

    const all = [];
    rows[0].values.forEach(r => all.push({ id: r[0], parent: r[1], name: r[2], type: r[3], image: r[4] }));

    function buildBranch(pid) {
        const kids = all.filter(g => g.parent === pid);
        if (!kids.length) return '';
        let h = '<div style="margin-left:10px; border-left:1px solid #333;">';
        kids.forEach(k => {
            const thumb = k.image
                ? `<img src="${esc(k.image)}" style="width:18px; height:18px; object-fit:cover; border-radius:3px; margin-right:6px;">`
                : '';
            h += `<div class="tree-content" onclick="viewGroup(${k.id})">
                    <span style="color:#666; margin-right:5px;">└</span>
                    ${thumb}<span>${esc(k.name)}</span>
                  </div>
                  ${buildBranch(k.id)}`;
        });
        h += '</div>';
        return h;
    }
    container.innerHTML = buildBranch(null);
}

function renderMissionList() {
    const container = document.getElementById('missionsRoot');
    const res = DBSystem.exec("SELECT id, title, status FROM missions ORDER BY id DESC");
    if (!res.length) { container.innerHTML = ''; return; }

    let h = '';
    res[0].values.forEach(m => {
        let color = m[2] === 'Em Curso' ? 'var(--warning)' : (m[2] === 'Concluída' ? 'var(--success)' : '#666');
        h += `<div class="tree-content" onclick="viewMission(${m[0]})" style="justify-content:space-between;">
                <span>${esc(m[1])}</span>
                <div style="width:8px; height:8px; border-radius:50%; background:${color};"></div>
              </div>`;
    });
    container.innerHTML = h;
}

function renderScriptList() {
    const container = document.getElementById('scriptsRoot');
    const res = DBSystem.exec("SELECT id, title FROM scripts ORDER BY id DESC");
    if (!res.length) { container.innerHTML = ''; return; }

    let h = '';
    res[0].values.forEach(s => {
        h += `<div class="tree-content" onclick="viewScript(${s[0]})">📄 ${esc(s[1] || 'Sem Título')}</div>`;
    });
    container.innerHTML = h;
}

// --- VISUALIZAÇÃO DE CONTEÚDO (MAIN VIEW) ---

function viewGroup(id) {
    ensureSchema();
    const g = DBSystem.exec("SELECT * FROM groups WHERE id=" + id)[0].values[0];
    const imgRes = DBSystem.exec("SELECT image FROM groups WHERE id=" + id);
    const groupImg = imgRes.length ? imgRes[0].values[0][0] : '';
    const mems = DBSystem.exec("SELECT * FROM members WHERE group_id=" + id);

    let memHtml = '';
    if (mems.length) {
        mems[0].values.forEach(m => {
            let img = m[6] || 'https://via.placeholder.com/50?text=?';
            memHtml += `
                <div class="member-card" onclick="viewDossier(${m[0]})">
                    <img src="${esc(img)}" class="member-img">
                    <div>
                        <div style="font-weight:bold;">${esc(m[2])}</div>
                        <div style="font-size:0.7rem; color:${m[3] == 'Lider' ? 'var(--accent)' : '#888'}">${esc(m[3])}</div>
                    </div>
                </div>`;
        });
    } else { memHtml = '<p style="color:#666;">Sem membros.</p>'; }

    const groupImgHtml = groupImg
        ? `<img src="${esc(groupImg)}" style="width:110px; height:110px; object-fit:cover; border-radius:8px; border:1px solid #333; flex-shrink:0;">`
        : '';

    document.getElementById('contentArea').innerHTML = `
        <div style="margin-bottom:20px; border-bottom:1px solid #333; padding-bottom:15px;">
            <div style="float:right;">
                <button class="btn btn-outline" onclick="openNodeModal(${g[0]}, ${g[1] === null ? 'null' : g[1]})">Editar</button>
                <button class="btn btn-outline" onclick="openNodeModal(null, ${g[0]})">+ Subgrupo</button>
                <button class="btn btn-danger" onclick="deleteGroup(${g[0]})">🗑️ Excluir</button>
            </div>
            <div style="display:flex; gap:16px; align-items:flex-start;">
                ${groupImgHtml}
                <div>
                    <h1 style="color:var(--accent);">${esc(g[2])}</h1>
                    <div style="color:#888;">${esc(g[3] || 'Tipo indefinido')}</div>
                    <p style="margin-top:10px; white-space:pre-wrap;">${esc(g[4] || '')}</p>
                </div>
            </div>
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
            <h3>Membros</h3>
            <button class="btn btn-primary" onclick="openMemberModal(null, ${g[0]})">+ Adicionar</button>
        </div>
        <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap:10px;">
            ${memHtml}
        </div>
    `;
}

function viewDossier(id) {
    const m = DBSystem.exec("SELECT * FROM members WHERE id=" + id)[0].values[0];
    const g = DBSystem.exec("SELECT name FROM groups WHERE id=" + m[1])[0].values[0][0];

    const misRes = DBSystem.exec(`
        SELECT m.title, mm.role_type
        FROM missions m JOIN mission_members mm ON m.id = mm.mission_id
        WHERE mm.member_id = ${id}
    `);
    let misHtml = 'Sem histórico de missões.';
    if (misRes.length) {
        misHtml = misRes[0].values.map(r =>
            `<span style="display:inline-block; background:#222; padding:3px 8px; border-radius:4px; margin-right:5px; font-size:0.8rem; border:1px solid ${r[1] == 'Oponente' ? 'var(--danger)' : 'var(--success)'}">${esc(r[0])} (${esc(r[1] || '?')})</span>`
        ).join('');
    }

    document.getElementById('contentArea').innerHTML = `
        <button class="btn btn-outline" onclick="viewGroup(${m[1]})" style="margin-bottom:20px;">← Voltar para ${esc(g)}</button>

        <div class="dossier-header">
            <img src="${esc(m[6] || 'https://via.placeholder.com/150')}" class="dossier-avatar">
            <div class="dossier-info" style="flex:1;">
                <div style="display:flex; justify-content:space-between;">
                    <div class="dossier-role">${esc(m[3])} de ${esc(g)}</div>
                    <button class="btn btn-outline" onclick="openMemberModal(${m[0]})">✏️ Editar Ficha</button>
                </div>
                <h1>${esc(m[2])}</h1>
                <div style="margin-top:10px;">${misHtml}</div>
            </div>
        </div>

        <div class="dossier-grid">
            <div>
                <h3 style="color:var(--text-muted); margin-bottom:10px;">HISTÓRIA & BIO</h3>
                <div style="line-height:1.6; white-space:pre-wrap;">${esc(m[4] || 'Sem dados biográficos.')}</div>
            </div>
            <div>
                <h3 style="color:var(--text-muted); margin-bottom:10px;">FICHA TÉCNICA</h3>
                <div class="sheet-box" style="white-space:pre-wrap;">${esc(m[5] || 'Sem dados técnicos.')}</div>
            </div>
        </div>
    `;
}

// Bloco de texto da tela de missão (só aparece se tiver conteúdo)
function missionBlock(label, text) {
    if (!text || !String(text).trim()) return '';
    return `
        <div style="background:#111; padding:20px; margin-top:15px; border-radius:6px;">
            <h4 style="color:#666; margin-bottom:10px;">${label}</h4>
            <div style="line-height:1.6; white-space:pre-wrap;">${esc(text)}</div>
        </div>`;
}

function viewMission(id) {
    ensureSchema();
    const m = DBSystem.exec(
        "SELECT id, title, status, briefing, location, mission_date, objective, plan, notes FROM missions WHERE id=" + id
    )[0].values[0];
    const [mId, title, status, briefing, location, mDate, objective, plan, notes] = m;

    // Briefing e o antigo "O que vai acontecer" (plan) agora aparecem juntos
    const fullBriefing = [briefing, plan].filter(x => x && String(x).trim()).join('\n\n');

    // Grupos vinculados
    const gRes = DBSystem.exec(`
        SELECT g.id, g.name, g.image, mg.role_type
        FROM mission_groups mg JOIN groups g ON g.id = mg.group_id
        WHERE mg.mission_id = ${id} ORDER BY g.name
    `);
    const groups = gRes.length ? gRes[0].values : [];

    // Membros vinculados
    const pRes = DBSystem.exec(`
        SELECT mem.id, mem.name, mem.image, mm.role_type, g.name, mem.group_id
        FROM members mem
        JOIN mission_members mm ON mem.id = mm.member_id
        JOIN groups g ON mem.group_id = g.id
        WHERE mm.mission_id = ${id} ORDER BY mem.name
    `);
    const members = pRes.length ? pRes[0].values : [];

    const groupCard = g => `
        <div class="member-card" onclick="viewGroup(${g[0]})" style="margin-bottom:8px;">
            ${g[2] ? `<img src="${esc(g[2])}" class="member-img" style="width:36px;height:36px;">` : ''}
            <div>
                <div style="font-weight:bold; font-size:0.95rem;">${esc(g[1])}</div>
                <div style="font-size:0.7rem; color:#888;">Grupo</div>
            </div>
        </div>`;

    const memberCard = (p, indent) => `
        <div class="member-card" onclick="viewDossier(${p[0]})" style="margin-bottom:8px; ${indent ? 'margin-left:24px;' : ''}">
            <img src="${esc(p[2] || 'https://via.placeholder.com/30')}" class="member-img" style="width:30px;height:30px;">
            <div>
                <div style="font-weight:bold; font-size:0.9rem;">${esc(p[1])}</div>
                <div style="font-size:0.7rem; color:#888;">${esc(p[4])}</div>
            </div>
        </div>`;

    // Monta um lado (aliados ou oponentes): grupos primeiro, membros do grupo logo abaixo
    function buildSide(enemy) {
        const side = r => (r === 'Oponente') === enemy;
        const gs = groups.filter(g => side(g[3]));
        const ms = members.filter(p => side(p[3]));
        const used = new Set();
        let h = '';
        gs.forEach(g => {
            h += groupCard(g);
            ms.filter(p => p[5] === g[0]).forEach(p => { used.add(p); h += memberCard(p, true); });
        });
        ms.filter(p => !used.has(p)).forEach(p => { h += memberCard(p, false); });
        return h;
    }

    const allies = buildSide(false);
    const enemies = buildSide(true);

    const statusColor = status == 'Em Curso' ? 'var(--warning)' : (status == 'Falha' ? 'var(--danger)' : 'var(--success)');

    let infoHtml = '';
    if (location || mDate) {
        infoHtml = `<div style="display:flex; gap:25px; flex-wrap:wrap; margin-top:15px; color:#ccc;">
            ${location ? `<div>📍 <strong>Local:</strong> ${esc(location)}</div>` : ''}
            ${mDate ? `<div>🗓️ <strong>Data/Horário:</strong> ${esc(mDate)}</div>` : ''}
        </div>`;
    }

    document.getElementById('contentArea').innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #333; padding-bottom:15px;">
            <div>
                <h2 style="color:var(--accent); font-size:1.8rem;">${esc(title)}</h2>
                <span style="color:${statusColor}">${esc(status)}</span>
            </div>
            <div>
                <button class="btn btn-outline" onclick="openMissionModal(${mId})">Editar Dados</button>
                <button class="btn btn-primary" onclick="openLinkModal(${mId})">👥 Gerenciar Envolvidos</button>
                <button class="btn btn-danger" onclick="deleteMission(${mId})">🗑️</button>
            </div>
        </div>

        ${infoHtml}
        ${missionBlock('OBJETIVO', objective)}
        ${missionBlock('BRIEFING / O QUE VAI ACONTECER', fullBriefing)}
        ${missionBlock('OBSERVAÇÕES', notes)}

        <div class="vs-container">
            <div class="vs-col">
                <div class="vs-title ally">Aliados & Protagonistas</div>
                ${allies || '<p style="text-align:center; color:#555;">Ninguém escalado.</p>'}
            </div>
            <div class="vs-col">
                <div class="vs-title enemy">Oponentes & Ameaças</div>
                ${enemies || '<p style="text-align:center; color:#555;">Nenhuma ameaça identificada.</p>'}
            </div>
        </div>
    `;
}

// --- GERENCIAMENTO DE ROTEIROS ---

function createNewScript() {
    DBSystem.run("INSERT INTO scripts (title, content) VALUES ('Novo Roteiro', '')");
    renderScriptList();
    const id = DBSystem.exec("SELECT last_insert_rowid()")[0].values[0][0];
    viewScript(id);
}

function viewScript(id) {
    const s = DBSystem.exec("SELECT * FROM scripts WHERE id=" + id)[0].values[0];
    renderScriptEditor(id, s[1], s[2]);
}

function renderScriptEditor(id, title, content) {
    document.getElementById('contentArea').innerHTML = `
        <div style="display:flex; justify-content:space-between; margin-bottom:10px;">
            <input type="text" id="scriptTitle" value="${esc(title)}" style="width:50%; font-size:1.2rem; font-weight:bold;" onchange="autoSaveScript(${id})">
            <div>
                <button class="btn btn-primary" onclick="toggleReaderMode()">👁️ Modo Leitura</button>
                <button class="btn btn-danger" onclick="deleteScript(${id})">🗑️</button>
            </div>
        </div>
        <div id="editorContainer">
            <textarea id="scriptBody" class="script-editor" placeholder="Escreva seu roteiro aqui..." oninput="autoSaveScript(${id})">${esc(content)}</textarea>
        </div>
        <div id="readerContainer" style="display:none; background:#ccc; padding:20px; overflow-y:auto; height:calc(100vh - 150px);">
            <div class="script-reader">
                <h1 id="readTitle">${esc(title)}</h1>
                <div id="readBody">${formatScript(content)}</div>
            </div>
            <button class="btn btn-outline" style="position:fixed; bottom:20px; right:40px; background:#000; color:#fff;" onclick="toggleReaderMode()">✏️ Voltar a Editar</button>
        </div>
    `;
}

function toggleReaderMode() {
    const edit = document.getElementById('editorContainer');
    const read = document.getElementById('readerContainer');
    const body = document.getElementById('scriptBody').value;

    if (edit.style.display === 'none') {
        edit.style.display = 'block';
        read.style.display = 'none';
    } else {
        document.getElementById('readTitle').innerText = document.getElementById('scriptTitle').value;
        document.getElementById('readBody').innerHTML = formatScript(body);
        edit.style.display = 'none';
        read.style.display = 'block';
    }
}

function formatScript(txt) {
    return String(txt ?? '').split('\n').map(line => `<p>${line.trim() ? esc(line) : '<br>'}</p>`).join('');
}

function autoSaveScript(id) {
    const t = document.getElementById('scriptTitle').value;
    const c = document.getElementById('scriptBody').value;
    DBSystem.run("UPDATE scripts SET title=?, content=? WHERE id=?", [t, c, id]);
    renderScriptList();
}

function deleteScript(id) {
    if (confirm("Apagar roteiro?")) {
        DBSystem.run("DELETE FROM scripts WHERE id=" + id);
        renderScriptList();
        document.getElementById('contentArea').innerHTML = '';
    }
}