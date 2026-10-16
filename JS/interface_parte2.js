const MISSION_EXTRA_COLS = ['location', 'mission_date', 'objective', 'plan', 'notes'];

function ensureSchema() {
    try {
        const res = DBSystem.exec("PRAGMA table_info(missions)");
        if (res.length) {
            const cols = res[0].values.map(r => r[1]);
            MISSION_EXTRA_COLS.forEach(c => {
                if (!cols.includes(c)) DBSystem.run(`ALTER TABLE missions ADD COLUMN ${c} TEXT DEFAULT ''`);
            });
        }

        // Imagem do grupo
        const gres = DBSystem.exec("PRAGMA table_info(groups)");
        if (gres.length) {
            const gcols = gres[0].values.map(r => r[1]);
            if (!gcols.includes('image')) DBSystem.run("ALTER TABLE groups ADD COLUMN image TEXT DEFAULT ''");
        }

        DBSystem.run("CREATE TABLE IF NOT EXISTS mission_groups (mission_id INTEGER, group_id INTEGER, role_type TEXT)");
    } catch (e) {
        console.error('Falha ao atualizar o esquema:', e);
    }
}

// --- AJUSTES NOS MODAIS (feitos por JS, não precisa mexer no HTML) ---

function makeField(id, label, tag, placeholder, rows) {
    const wrap = document.createElement('div');
    wrap.style.marginTop = '10px';

    const lb = document.createElement('label');
    lb.htmlFor = id;
    lb.textContent = label;
    lb.style.cssText = 'display:block; font-size:0.75rem; color:#888; margin-bottom:4px;';

    const el = document.createElement(tag);
    el.id = id;
    if (placeholder) el.placeholder = placeholder;
    if (tag === 'textarea') el.rows = rows || 3; else el.type = 'text';
    el.style.cssText = 'width:100%; box-sizing:border-box;';

    wrap.appendChild(lb);
    wrap.appendChild(el);
    return wrap;
}

function setupMissionModal() {
    const modal = document.getElementById('modalMission');
    const brief = document.getElementById('missBriefing');
    if (!modal || !brief) return;

    // Campos novos (inseridos logo após o Briefing)
    if (!document.getElementById('missLocation')) {
        const bl = brief.previousElementSibling;
        if (bl && bl.tagName === 'LABEL') bl.textContent = 'Briefing / O que vai acontecer';
        brief.rows = 7;

        const fields = [
            makeField('missLocation',  'Local da missão', 'input', 'Ex.: Porto de Santos, armazém 12'),
            makeField('missDate',      'Data / Horário', 'input', 'Ex.: Dia 3, 22h00'),
            makeField('missObjective', 'Objetivo', 'textarea', 'O que precisa ser cumprido?', 2),
            makeField('missNotes',     'Observações / Recompensas', 'textarea', 'Anotações do mestre, recompensas, ganchos futuros...', 3)
        ];
        let ref = brief;
        fields.forEach(f => { ref.after(f); ref = f; });
    }

    // Botão Cancelar
    if (!modal.querySelector('.btn-cancel-mission')) {
        const cancel = document.createElement('button');
        cancel.type = 'button';
        cancel.className = 'btn btn-outline btn-cancel-mission';
        cancel.textContent = 'Cancelar';
        cancel.style.marginRight = '8px';
        cancel.onclick = () => closeModal('modalMission');

        const saveBtn = modal.querySelector('button[onclick*="saveMission"]');
        if (saveBtn) saveBtn.before(cancel);
        else (modal.firstElementChild || modal).appendChild(cancel);
    }
}

// Cria o seletor de imagem (arquivo + prévia + remover) logo depois do campo "hidden".
// O campo hidden guarda a imagem como data URL. Os ids derivam do id do hidden:
//   <id>File, <id>Preview, <id>Remove
function buildImageUploader(hidden, labelText) {
    const id = hidden.id;
    const box = document.createElement('div');
    box.style.marginTop = '10px';
    box.innerHTML = `
        ${labelText ? `<label style="display:block; font-size:0.75rem; color:#888; margin-bottom:4px;">${labelText}</label>` : ''}
        <div style="display:flex; align-items:center; gap:12px; margin-top:6px;">
            <img id="${id}Preview" style="display:none; width:64px; height:64px; object-fit:cover; border-radius:6px; border:1px solid #333;">
            <div>
                <input type="file" id="${id}File" accept="image/*" onchange="handleImageFile(this, '${id}')">
                <button type="button" class="btn btn-outline" id="${id}Remove" style="display:none; margin-top:6px;" onclick="clearImage('${id}')">Remover imagem</button>
            </div>
        </div>`;
    hidden.after(box);
}

function setupMemberImageField() {
    const img = document.getElementById('memImg');
    if (!img || document.getElementById('memImgFile')) return;

    // O input original vira um campo oculto que guarda a imagem (data URL ou link antigo)
    img.style.display = 'none';
    const prev = img.previousElementSibling;
    if (prev && prev.tagName === 'LABEL') prev.textContent = 'Imagem (enviar arquivo)';
    buildImageUploader(img, '');
}

function setupNodeImageField() {
    const desc = document.getElementById('nodeDesc');
    if (!desc || document.getElementById('nodeImgFile')) return;

    // Campo oculto que guarda a imagem do grupo
    const hidden = document.createElement('input');
    hidden.type = 'hidden';
    hidden.id = 'nodeImg';
    desc.after(hidden);
    buildImageUploader(hidden, 'Imagem do grupo (enviar arquivo)');
}

function setupModals() {
    setupMissionModal();
    setupMemberImageField();
    setupNodeImageField();
}

// --- UPLOAD DE IMAGEM (redimensiona e guarda dentro do próprio banco) ---

function resizeImageToDataUrl(file, maxSize) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = reject;
        reader.onload = () => {
            const im = new Image();
            im.onerror = reject;
            im.onload = () => {
                const scale = Math.min(1, maxSize / Math.max(im.width, im.height));
                const w = Math.max(1, Math.round(im.width * scale));
                const h = Math.max(1, Math.round(im.height * scale));
                const canvas = document.createElement('canvas');
                canvas.width = w; canvas.height = h;
                canvas.getContext('2d').drawImage(im, 0, 0, w, h);
                resolve(canvas.toDataURL('image/webp', 0.85));
            };
            im.src = reader.result;
        };
        reader.readAsDataURL(file);
    });
}

async function handleImageFile(input, hiddenId) {
    const file = input.files && input.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
        alert('Escolha um arquivo de imagem.');
        input.value = '';
        return;
    }
    try {
        document.getElementById(hiddenId).value = await resizeImageToDataUrl(file, 480);
        updateImagePreview(hiddenId);
    } catch (e) {
        alert('Não foi possível ler essa imagem.');
        input.value = '';
    }
}

function clearImage(hiddenId) {
    document.getElementById(hiddenId).value = '';
    const f = document.getElementById(hiddenId + 'File');
    if (f) f.value = '';
    updateImagePreview(hiddenId);
}

function updateImagePreview(hiddenId) {
    const val = document.getElementById(hiddenId).value;
    const prev = document.getElementById(hiddenId + 'Preview');
    const rm = document.getElementById(hiddenId + 'Remove');
    if (!prev || !rm) return;
    if (val) { prev.src = val; prev.style.display = 'block'; rm.style.display = 'inline-block'; }
    else { prev.removeAttribute('src'); prev.style.display = 'none'; rm.style.display = 'none'; }
}

// --- LOGICA DE CONTROLE DOS MODAIS (CRUD) ---

function openMemberModal(id, gid) {
    setupModals();
    document.getElementById('memId').value = id || '';
    document.getElementById('memGroupId').value = gid || '';
    if (id) {
        const m = DBSystem.exec("SELECT * FROM members WHERE id=" + id)[0].values[0];
        document.getElementById('memGroupId').value = m[1];
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
    const f = document.getElementById('memImgFile');
    if (f) f.value = '';
    updateImagePreview('memImg');
    document.getElementById('modalMember').classList.add('open');
}

function saveMember() {
    const id = document.getElementById('memId').value;
    const gid = document.getElementById('memGroupId').value;
    const name = document.getElementById('memName').value.trim();
    const role = document.getElementById('memRole').value;
    const hist = document.getElementById('memHistory').value;
    const sheet = document.getElementById('memSheet').value;
    const img = document.getElementById('memImg').value;

    if (!name) return alert('Dê um nome ao membro.');

    if (id) {
        DBSystem.run("UPDATE members SET name=?, role=?, history=?, sheet=?, image=? WHERE id=?", [name, role, hist, sheet, img, id]);
        closeModal('modalMember');
        viewDossier(id);
    } else {
        DBSystem.run("INSERT INTO members (group_id, name, role, history, sheet, image) VALUES (?,?,?,?,?,?)", [gid, name, role, hist, sheet, img]);
        closeModal('modalMember');
        viewGroup(gid);
    }
}

function deleteMember() {
    const id = document.getElementById('memId').value;
    const gid = document.getElementById('memGroupId').value;
    if (id && confirm("Excluir este membro definitivamente?")) {
        DBSystem.run("DELETE FROM mission_members WHERE member_id=" + id);
        DBSystem.run("DELETE FROM members WHERE id=" + id);
        closeModal('modalMember');
        if (gid) viewGroup(gid);
        else document.getElementById('contentArea').innerHTML = '';
        refreshAll();
    }
}

function openMissionModal(id) {
    ensureSchema();
    setupModals();

    const set = (el, v) => { document.getElementById(el).value = v ?? ''; };
    set('missId', id || '');

    if (id) {
        const m = DBSystem.exec(
            "SELECT title, status, briefing, location, mission_date, objective, plan, notes FROM missions WHERE id=" + id
        )[0].values[0];
        set('missTitle', m[0]);
        set('missStatus', m[1]);
        // junta o antigo campo "plan" ao briefing, sem perder nada
        set('missBriefing', [m[2], m[6]].filter(x => x && x.trim()).join('\n\n'));
        set('missLocation', m[3]);
        set('missDate', m[4]);
        set('missObjective', m[5]);
        set('missNotes', m[7]);
    } else {
        ['missTitle', 'missBriefing', 'missLocation', 'missDate', 'missObjective', 'missNotes'].forEach(k => set(k, ''));
        set('missStatus', 'Planejamento');
    }
    document.getElementById('modalMission').classList.add('open');
}

function saveMission() {
    ensureSchema();
    const val = el => document.getElementById(el).value;
    const id = val('missId');
    const t = val('missTitle').trim();
    if (!t) return alert('Dê um título à missão.');

    // plan fica vazio: agora tudo vai no briefing
    const data = [t, val('missStatus'), val('missBriefing'), val('missLocation'), val('missDate'), val('missObjective'), '', val('missNotes')];

    let targetId = id;
    if (id) {
        DBSystem.run(
            "UPDATE missions SET title=?, status=?, briefing=?, location=?, mission_date=?, objective=?, plan=?, notes=? WHERE id=?",
            [...data, id]
        );
    } else {
        DBSystem.run(
            "INSERT INTO missions (title, status, briefing, location, mission_date, objective, plan, notes) VALUES (?,?,?,?,?,?,?,?)",
            data
        );
        targetId = DBSystem.exec("SELECT last_insert_rowid()")[0].values[0][0];
    }

    closeModal('modalMission');
    renderMissionList();
    viewMission(targetId);
}

function deleteMission(id) {
    if (!confirm("Excluir esta missão definitivamente?")) return;
    ensureSchema();
    DBSystem.run("DELETE FROM mission_members WHERE mission_id=" + id);
    DBSystem.run("DELETE FROM mission_groups WHERE mission_id=" + id);
    DBSystem.run("DELETE FROM missions WHERE id=" + id);
    renderMissionList();
    document.getElementById('contentArea').innerHTML = '';
}

// --- VÍNCULO DA MISSÃO: GRUPOS (+ MEMBROS OPCIONAIS) ---

function openLinkModal(mid) {
    ensureSchema();
    document.getElementById('linkMissionId').value = mid;
    const list = document.getElementById('linkListContainer');

    const groups = DBSystem.exec("SELECT id, name, type FROM groups ORDER BY name");
    const members = DBSystem.exec("SELECT id, group_id, name, role FROM members ORDER BY name");

    const gMap = {}, mMap = {};
    const lg = DBSystem.exec("SELECT group_id, role_type FROM mission_groups WHERE mission_id=" + mid);
    if (lg.length) lg[0].values.forEach(r => gMap[r[0]] = r[1]);
    const lm = DBSystem.exec("SELECT member_id, role_type FROM mission_members WHERE mission_id=" + mid);
    if (lm.length) lm[0].values.forEach(r => mMap[r[0]] = r[1]);

    const membersByGroup = {};
    if (members.length) members[0].values.forEach(m => {
        (membersByGroup[m[1]] = membersByGroup[m[1]] || []).push(m);
    });

    const opts = cur => `
        <option value="" ${!cur ? 'selected' : ''}>--</option>
        <option value="Aliado" ${cur === 'Aliado' ? 'selected' : ''}>Aliado</option>
        <option value="Oponente" ${cur === 'Oponente' ? 'selected' : ''}>Oponente</option>`;
    const selStyle = 'width:120px; margin:0; padding:2px; height:auto; background:#111;';

    let h = '<table style="width:100%; border-collapse:collapse;">';
    if (groups.length) {
        groups[0].values.forEach(g => {
            h += `
                <tr style="border-bottom:1px solid #333; background:#141414;">
                    <td style="padding:6px; font-weight:bold;">${esc(g[1])} <span style="color:#666; font-size:0.8em; font-weight:normal;">${esc(g[2] || '')}</span></td>
                    <td style="text-align:right;">
                        <select class="link-group-select" data-gid="${g[0]}" style="${selStyle}">${opts(gMap[g[0]])}</select>
                    </td>
                </tr>`;
            (membersByGroup[g[0]] || []).forEach(m => {
                h += `
                <tr style="border-bottom:1px solid #222;">
                    <td style="padding:4px 4px 4px 24px;">${esc(m[2])} <span style="color:#666; font-size:0.8em;">(${esc(m[3] || '')})</span></td>
                    <td style="text-align:right;">
                        <select class="link-select" data-mid="${m[0]}" style="${selStyle}">${opts(mMap[m[0]])}</select>
                    </td>
                </tr>`;
            });
        });
    }
    h += '</table>';
    list.innerHTML = h;
    document.getElementById('modalLink').classList.add('open');
}

function confirmLinkAgents() {
    ensureSchema();
    const mid = document.getElementById('linkMissionId').value;

    DBSystem.run("DELETE FROM mission_members WHERE mission_id=" + mid);
    DBSystem.run("DELETE FROM mission_groups WHERE mission_id=" + mid);

    const gStmt = DBSystem.prepare("INSERT INTO mission_groups (mission_id, group_id, role_type) VALUES (?,?,?)");
    document.querySelectorAll('.link-group-select').forEach(s => {
        if (s.value) gStmt.run([mid, s.dataset.gid, s.value]);
    });
    gStmt.free();

    const mStmt = DBSystem.prepare("INSERT INTO mission_members (mission_id, member_id, role_type) VALUES (?,?,?)");
    document.querySelectorAll('.link-select').forEach(s => {
        if (s.value) mStmt.run([mid, s.dataset.mid, s.value]);
    });
    mStmt.free();

    closeModal('modalLink');
    viewMission(mid);
}

// --- GRUPOS (NÓS DA ÁRVORE) ---

function openNodeModal(id, pid) {
    ensureSchema();
    setupModals();
    document.getElementById('nodeId').value = id || '';
    document.getElementById('nodeParentId').value = pid || '';
    if (id) {
        const r = DBSystem.exec("SELECT name, type, description, image FROM groups WHERE id=" + id)[0].values[0];
        document.getElementById('nodeName').value = r[0];
        document.getElementById('nodeType').value = r[1];
        document.getElementById('nodeDesc').value = r[2];
        document.getElementById('nodeImg').value = r[3] || '';
    } else {
        document.getElementById('nodeName').value = '';
        document.getElementById('nodeType').value = '';
        document.getElementById('nodeDesc').value = '';
        document.getElementById('nodeImg').value = '';
    }
    const f = document.getElementById('nodeImgFile');
    if (f) f.value = '';
    updateImagePreview('nodeImg');
    document.getElementById('modalNode').classList.add('open');
}

function saveNode() {
    ensureSchema();
    const id = document.getElementById('nodeId').value;
    const pid = document.getElementById('nodeParentId').value;
    const n = document.getElementById('nodeName').value.trim();
    const t = document.getElementById('nodeType').value;
    const d = document.getElementById('nodeDesc').value;
    const img = document.getElementById('nodeImg').value;
    if (!n) return alert('Dê um nome ao grupo.');
    if (id) DBSystem.run("UPDATE groups SET name=?, type=?, description=?, image=? WHERE id=?", [n, t, d, img, id]);
    else DBSystem.run("INSERT INTO groups (parent_id, name, type, description, image) VALUES (?,?,?,?,?)", [pid || null, n, t, d, img]);
    closeModal('modalNode');
    renderGroupTree();
    if (id) viewGroup(id);
}

// --- EXCLUSÃO DE GRUPOS (EM CASCATA) ---

// Retorna o id do grupo + ids de todos os descendentes (subgrupos, sub-subgrupos...)
function collectGroupIds(rootId) {
    const res = DBSystem.exec("SELECT id, parent_id FROM groups");
    const rows = res.length ? res[0].values : [];
    const ids = [Number(rootId)];
    for (let i = 0; i < ids.length; i++) {
        rows.forEach(r => { if (r[1] === ids[i]) ids.push(r[0]); });
    }
    return ids;
}

function deleteGroup(id) {
    id = Number(id);
    const ids = collectGroupIds(id);
    const list = ids.join(',');

    const memRes = DBSystem.exec(`SELECT COUNT(*) FROM members WHERE group_id IN (${list})`);
    const memCount = memRes.length ? memRes[0].values[0][0] : 0;

    const msg = `Excluir este grupo definitivamente?\n\n` +
                `• Subgrupos que serão apagados: ${ids.length - 1}\n` +
                `• Membros que serão apagados: ${memCount}\n\n` +
                `Essa ação não pode ser desfeita.`;
    if (!confirm(msg)) return;

    const parentRes = DBSystem.exec("SELECT parent_id FROM groups WHERE id=" + id);
    const parentId = parentRes.length ? parentRes[0].values[0][0] : null;

    ensureSchema();
    // Ordem importa: vínculos -> membros -> grupos
    DBSystem.run(`DELETE FROM mission_members WHERE member_id IN (SELECT id FROM members WHERE group_id IN (${list}))`);
    DBSystem.run(`DELETE FROM mission_groups WHERE group_id IN (${list})`);
    DBSystem.run(`DELETE FROM members WHERE group_id IN (${list})`);
    DBSystem.run(`DELETE FROM groups WHERE id IN (${list})`);

    refreshAll();
    if (parentId) viewGroup(parentId);
    else document.getElementById('contentArea').innerHTML = '';
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
        ensureSchema(); // garante coluna de imagem do grupo e tabela mission_groups em bancos antigos
        refreshAll();
    }
    r.readAsArrayBuffer(f);
}