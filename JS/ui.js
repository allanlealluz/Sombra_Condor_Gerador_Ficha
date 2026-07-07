// --- RENDERIZADORES DE INTERFACE (SIDEBAR) ---

function refreshAll() {
    renderGroupTree();
    renderMissionList();
    renderScriptList();
}

function renderGroupTree() {
    const container = document.getElementById('groupsRoot');
    const rows = DBSystem.exec("SELECT * FROM groups ORDER BY name ASC");
    if (rows.length === 0) { container.innerHTML = ''; return; }
    
    const all = [];
    rows[0].values.forEach(r => all.push({ id: r[0], parent: r[1], name: r[2], type: r[3] }));

    function buildBranch(pid) {
        const kids = all.filter(g => g.parent === pid);
        if (!kids.length) return '';
        let h = '<div style="margin-left:10px; border-left:1px solid #333;">';
        kids.forEach(k => {
            h += `<div class="tree-content" onclick="viewGroup(${k.id})">
                    <span style="color:#666; margin-right:5px;">└</span>
                    <span>${k.name}</span>
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
                <span>${m[1]}</span>
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
        h += `<div class="tree-content" onclick="viewScript(${s[0]})">📄 ${s[1] || 'Sem Título'}</div>`;
    });
    container.innerHTML = h;
}

// --- VISUALIZAÇÃO DE CONTEÚDO (MAIN VIEW) ---

function viewGroup(id) {
    const g = DBSystem.exec("SELECT * FROM groups WHERE id=" + id)[0].values[0];
    const mems = DBSystem.exec("SELECT * FROM members WHERE group_id=" + id);
    
    let memHtml = '';
    if (mems.length) {
        mems[0].values.forEach(m => {
            let img = m[6] || 'https://via.placeholder.com/50?text=?';
            memHtml += `
                <div class="member-card" onclick="viewDossier(${m[0]})">
                    <img src="${img}" class="member-img">
                    <div>
                        <div style="font-weight:bold;">${m[2]}</div>
                        <div style="font-size:0.7rem; color:${m[3] == 'Lider' ? 'var(--accent)' : '#888'}">${m[3]}</div>
                    </div>
                </div>`;
        });
    } else { memHtml = '<p style="color:#666;">Sem membros.</p>'; }

    document.getElementById('contentArea').innerHTML = `
        <div style="margin-bottom:20px; border-bottom:1px solid #333; padding-bottom:15px;">
            <div style="float:right;">
                <button class="btn btn-outline" onclick="openNodeModal(${g[0]}, ${g[1]})">Editar</button>
                <button class="btn btn-outline" onclick="openNodeModal(null, ${g[0]})">+ Subgrupo</button>
            </div>
            <h1 style="color:var(--accent);">${g[2]}</h1>
            <div style="color:#888;">${g[3] || 'Tipo indefinido'}</div>
            <p style="margin-top:10px;">${g[4] || ''}</p>
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
            `<span style="display:inline-block; background:#222; padding:3px 8px; border-radius:4px; margin-right:5px; font-size:0.8rem; border:1px solid ${r[1] == 'Oponente' ? 'var(--danger)' : 'var(--success)'}">${r[0]} (${r[1] || '?'})</span>`
        ).join('');
    }

    document.getElementById('contentArea').innerHTML = `
        <button class="btn btn-outline" onclick="viewGroup(${m[1]})" style="margin-bottom:20px;">← Voltar para ${g}</button>
        
        <div class="dossier-header">
            <img src="${m[6] || 'https://via.placeholder.com/150'}" class="dossier-avatar">
            <div class="dossier-info" style="flex:1;">
                <div style="display:flex; justify-content:space-between;">
                    <div class="dossier-role">${m[3]} de ${g}</div>
                    <button class="btn btn-outline" onclick="openMemberModal(${m[0]})">✏️ Editar Ficha</button>
                </div>
                <h1>${m[2]}</h1>
                <div style="margin-top:10px;">${misHtml}</div>
            </div>
        </div>

        <div class="dossier-grid">
            <div>
                <h3 style="color:var(--text-muted); margin-bottom:10px;">HISTÓRIA & BIO</h3>
                <div style="line-height:1.6;">${m[4] || 'Sem dados biográficos.'}</div>
            </div>
            <div>
                <h3 style="color:var(--text-muted); margin-bottom:10px;">FICHA TÉCNICA</h3>
                <div class="sheet-box">${m[5] || 'Sem dados técnicos.'}</div>
            </div>
        </div>
    `;
}

function viewMission(id) {
    const m = DBSystem.exec("SELECT * FROM missions WHERE id=" + id)[0].values[0];
    
    const parts = DBSystem.exec(`
        SELECT mem.id, mem.name, mem.image, mm.role_type, g.name
        FROM members mem
        JOIN mission_members mm ON mem.id = mm.member_id
        JOIN groups g ON mem.group_id = g.id
        WHERE mm.mission_id = ${id}
    `);

    let allies = '', enemies = '';
    if (parts.length) {
        parts[0].values.forEach(p => {
            const card = `
                <div class="member-card" onclick="viewDossier(${p[0]})" style="margin-bottom:8px;">
                    <img src="${p[2] || 'https://via.placeholder.com/30'}" class="member-img" style="width:30px;height:30px;">
                    <div>
                        <div style="font-weight:bold; font-size:0.9rem;">${p[1]}</div>
                        <div style="font-size:0.7rem; color:#888;">${p[4]}</div>
                    </div>
                </div>`;
            
            if (p[3] === 'Oponente') enemies += card;
            else allies += card;
        });
    }

    document.getElementById('contentArea').innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #333; padding-bottom:15px;">
            <div>
                <h2 style="color:var(--accent); font-size:1.8rem;">${m[1]}</h2>
                <span style="color:${m[2] == 'Em Curso' ? 'var(--warning)' : (m[2] == 'Falha' ? 'var(--danger)' : 'var(--success)')}">${m[2]}</span>
            </div>
            <div>
                <button class="btn btn-outline" onclick="openMissionModal(${m[0]})">Editar Dados</button>
                <button class="btn btn-primary" onclick="openLinkModal(${m[0]})">👥 Gerenciar Equipe</button>
            </div>
        </div>

        <div style="background:#111; padding:20px; margin-top:20px; border-radius:6px;">
            <h4 style="color:#666; margin-bottom:10px;">BRIEFING</h4>
            <div style="line-height:1.6; white-space:pre-wrap;">${m[3]}</div>
        </div>

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
            <input type="text" id="scriptTitle" value="${title}" style="width:50%; font-size:1.2rem; font-weight:bold;" onchange="autoSaveScript(${id})">
            <div>
                <button class="btn btn-primary" onclick="toggleReaderMode()">👁️ Modo Leitura</button>
                <button class="btn btn-danger" onclick="deleteScript(${id})">🗑️</button>
            </div>
        </div>
        <div id="editorContainer">
            <textarea id="scriptBody" class="script-editor" placeholder="Escreva seu roteiro aqui..." oninput="autoSaveScript(${id})">${content}</textarea>
        </div>
        <div id="readerContainer" style="display:none; background:#ccc; padding:20px; overflow-y:auto; height:calc(100vh - 150px);">
            <div class="script-reader">
                <h1 id="readTitle">${title}</h1>
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
    return txt.split('\n').map(line => `<p>${line}</p>`).join('');
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

// --- LOGICA DE CONTROLE DOS MODAIS (CRUD) ---

function openMemberModal(id, gid) {
    document.getElementById('memId').value = id || '';
    document.getElementById('memGroupId').value = gid || '';
    if (id) {
        const m = DBSystem.exec("SELECT * FROM members WHERE id=" + id)[0].values[0];
        document.getElementById('memName').value = m[2];
        document.getElementById('memRole').value = m[3];
        document.getElementById('memHistory').value = m[4];
        document.getElementById('memSheet').value = m[5];
        document.getElementById('memImg').value = m[6] || '';
    } else {
        document.getElementById('memName').value = '';
        document.getElementById('memRole').value = 'Membro';
        document.getElementById('memHistory').value = '';
        document.getElementById('memSheet').value = '';
        document.getElementById('memImg').value = '';
    }
    document.getElementById('modalMember').classList.add('open');
}

function saveMember() {
    const id = document.getElementById('memId').value;
    const gid = document.getElementById('memGroupId').value;
    const name = document.getElementById('memName').value;
    const role = document.getElementById('memRole').value;
    const hist = document.getElementById('memHistory').value;
    const sheet = document.getElementById('memSheet').value;
    const img = document.getElementById('memImg').value;

    if (id) DBSystem.run("UPDATE members SET name=?, role=?, history=?, sheet=?, image=? WHERE id=?", [name, role, hist, sheet, img, id]);
    else DBSystem.run("INSERT INTO members (group_id, name, role, history, sheet, image) VALUES (?,?,?,?,?,?)", [gid, name, role, hist, sheet, img]);
    
    closeModal('modalMember');
    viewGroup(gid);
}

function deleteMember() {
    const id = document.getElementById('memId').value;
    const gid = document.getElementById('memGroupId').value;
    if (id && confirm("Excluir este membro definitivamente?")) {
        DBSystem.run("DELETE FROM members WHERE id=" + id);
        closeModal('modalMember');
        if (gid) viewGroup(gid);
        else document.getElementById('contentArea').innerHTML = '';
        refreshAll();
    }
}

function openMissionModal(id) {
    document.getElementById('missId').value = id || '';
    if (id) {
        const m = DBSystem.exec("SELECT * FROM missions WHERE id=" + id)[0].values[0];
        document.getElementById('missTitle').value = m[1];
        document.getElementById('missStatus').value = m[2];
        document.getElementById('missBriefing').value = m[3];
    } else {
        document.getElementById('missTitle').value = '';
        document.getElementById('missStatus').value = 'Planejamento';
        document.getElementById('missBriefing').value = '';
    }
    document.getElementById('modalMission').classList.add('open');
}

function saveMission() {
    const id = document.getElementById('missId').value;
    const t = document.getElementById('missTitle').value;
    const s = document.getElementById('missStatus').value;
    const b = document.getElementById('missBriefing').value;
    
    if (id) { DBSystem.run("UPDATE missions SET title=?, status=?, briefing=? WHERE id=?", [t, s, b, id]); viewMission(id); }
    else { DBSystem.run("INSERT INTO missions (title, status, briefing) VALUES (?,?,?)", [t, s, b]); }
    
    closeModal('modalMission');
    renderMissionList();
}

function openLinkModal(mid) {
    document.getElementById('linkMissionId').value = mid;
    const list = document.getElementById('linkListContainer');
    
    const all = DBSystem.exec("SELECT m.id, m.name, g.name FROM members m JOIN groups g ON m.group_id = g.id ORDER BY g.name");
    const linked = DBSystem.exec("SELECT member_id, role_type FROM mission_members WHERE mission_id=" + mid);
    const linkMap = {};
    if (linked.length) linked[0].values.forEach(l => linkMap[l[0]] = l[1]);

    let h = '<table style="width:100%; border-collapse:collapse;">';
    if (all.length) {
        all[0].values.forEach(m => {
            const myRole = linkMap[m[0]]; 
            h += `
                <tr style="border-bottom:1px solid #222;">
                    <td style="padding:5px;">${m[1]} <span style="color:#666; font-size:0.8em;">(${m[2]})</span></td>
                    <td style="text-align:right;">
                        <select class="link-select" data-mid="${m[0]}" style="width:120px; margin:0; padding:2px; height:auto; background:#111;">
                            <option value="" ${!myRole ? 'selected' : ''}>--</option>
                            <option value="Aliado" ${myRole == 'Aliado' ? 'selected' : ''}>Aliado</option>
                            <option value="Oponente" ${myRole == 'Oponente' ? 'selected' : ''}>Oponente</option>
                        </select>
                    </td>
                </tr>
            `;
        });
    }
    h += '</table>';
    list.innerHTML = h;
    document.getElementById('modalLink').classList.add('open');
}

function confirmLinkAgents() {
    const mid = document.getElementById('linkMissionId').value;
    const selects = document.querySelectorAll('.link-select');
    
    DBSystem.run("DELETE FROM mission_members WHERE mission_id=" + mid);
    
    const stmt = DBSystem.prepare("INSERT INTO mission_members (mission_id, member_id, role_type) VALUES (?,?,?)");
    selects.forEach(s => {
        if (s.value) {
            stmt.run([mid, s.dataset.mid, s.value]);
        }
    });
    stmt.free();
    closeModal('modalLink');
    viewMission(mid);
}

function openNodeModal(id, pid) {
    document.getElementById('nodeId').value = id || ''; 
    document.getElementById('nodeParentId').value = pid || '';
    if (id) {
         const r = DBSystem.exec("SELECT * FROM groups WHERE id=" + id)[0].values[0];
         document.getElementById('nodeName').value = r[2]; 
         document.getElementById('nodeType').value = r[3]; 
         document.getElementById('nodeDesc').value = r[4];
    } else {
        document.getElementById('nodeName').value = ''; 
        document.getElementById('nodeType').value = ''; 
        document.getElementById('nodeDesc').value = '';
    }
    document.getElementById('modalNode').classList.add('open');
}

function saveNode() {
    const id = document.getElementById('nodeId').value;
    const pid = document.getElementById('nodeParentId').value;
    const n = document.getElementById('nodeName').value;
    const t = document.getElementById('nodeType').value;
    const d = document.getElementById('nodeDesc').value;
    if (id) DBSystem.run("UPDATE groups SET name=?, type=?, description=? WHERE id=?", [n, t, d, id]);
    else DBSystem.run("INSERT INTO groups (parent_id, name, type, description) VALUES (?,?,?,?)", [pid || null, n, t, d]);
    closeModal('modalNode');
    renderGroupTree();
    if (id) viewGroup(id);
}

// --- UTILITÁRIOS GERAIS DE UI ---

function switchTab(t) {
    document.querySelectorAll('.tree-container').forEach(e => e.style.display = 'none');
    document.getElementById(t === 'groups' ? 'tabGroups' : (t === 'missions' ? 'tabMissions' : 'tabScripts')).style.display = 'block';
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    
    const evt = window.event;
    if (evt) evt.target.classList.add('active');
}

function closeModal(id) { 
    document.getElementById(id).classList.remove('open'); 
}

function saveDatabaseToFile() {
    const exported = DBSystem.exportDatabase();
    const blob = new Blob([exported], { type: 'application/x-sqlite3' });
    const a = document.createElement('a'); 
    a.href = URL.createObjectURL(blob);
    a.download = `sombra_condor_${new Date().toISOString().slice(0,10)}.sqlite`; 
    a.click();
}

function loadDatabaseFromFile(i) {
    const f = i.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = function() { 
        DBSystem.loadFromArrayBuffer(r.result);
        refreshAll(); 
    }
    r.readAsArrayBuffer(f);
}