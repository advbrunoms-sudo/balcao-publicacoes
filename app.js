(function () {
  "use strict";

  // ======================================================================
  // CONFIGURAÇÃO DO FIREBASE
  // Cole aqui o MESMO firebaseConfig usado no app do RPV/precatório e no
  // balcão de publicações (Firebase Console → ⚙️ Configurações do projeto
  // → aba "Geral" → role até "Seus aplicativos" → app da Web → "Config").
  // ======================================================================
  var firebaseConfig = {
    apiKey: "COLE_AQUI",
    authDomain: "COLE_AQUI.firebaseapp.com",
    projectId: "COLE_AQUI",
    storageBucket: "COLE_AQUI.appspot.com",
    messagingSenderId: "COLE_AQUI",
    appId: "COLE_AQUI"
  };

  firebase.initializeApp(firebaseConfig);
  var auth = firebase.auth();
  var db = firebase.firestore();
  try { db.enablePersistence({ synchronizeTabs: true }); } catch (e) { /* ok ignorar */ }

  var STATE_DOC = db.collection("carrinhoPublicacao").doc("estado");
  var HORARIOS = ["08:00 às 10:00", "10:00 às 12:00", "12:00 às 14:00"];
  var MESES = ["JANEIRO","FEVEREIRO","MARÇO","ABRIL","MAIO","JUNHO","JULHO","AGOSTO","SETEMBRO","OUTUBRO","NOVEMBRO","DEZEMBRO"];

  // ---------- utilidades ----------
  function slugify(s) {
    var base = s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    return base || ("p" + Date.now());
  }
  function uid(existingIds, base) {
    var id = base, n = 2;
    while (existingIds.indexOf(id) !== -1) { id = base + "-" + n; n++; }
    return id;
  }
  function pairKey(a, b) { return [a, b].slice().sort().join("|"); }
  function monthKey(y, m) { return y + "-" + String(m).padStart(2, "0"); }
  function fmtDateBR(iso) {
    var parts = iso.split("-");
    return parts[2] + "/" + parts[1] + "/" + parts[0].slice(2);
  }
  function getSaturdays(year, month) {
    var out = [];
    var d = new Date(year, month - 1, 1);
    while (d.getMonth() === month - 1) {
      if (d.getDay() === 6) {
        var iso = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
        out.push(iso);
      }
      d.setDate(d.getDate() + 1);
    }
    return out;
  }

  function personById(id) { return state.people.find(function (p) { return p.id === id; }); }
  function personName(id) { var p = personById(id); return p ? p.nome : id; }
  function areSpouses(idA, idB) {
    var a = personById(idA), b = personById(idB);
    if (!a || !b) return false;
    return (a.conjugeId === idB) && (b.conjugeId === idA);
  }
  function validPair(idA, idB) {
    var a = personById(idA), b = personById(idB);
    if (!a || !b) return false;
    if (a.genero === b.genero) return true;
    return areSpouses(idA, idB);
  }

  // ---------- estado ----------
  var state = null;

  function defaultState() {
    var people = [
      { id: "bruno", nome: "Bruno", genero: "M", conjugeId: null },
      { id: "patrick", nome: "Patrick", genero: "M", conjugeId: null },
      { id: "jose", nome: "José", genero: "M", conjugeId: "luciene" },
      { id: "helena", nome: "Helena", genero: "F", conjugeId: null },
      { id: "emily", nome: "Emily", genero: "F", conjugeId: null },
      { id: "luciene", nome: "Luciene", genero: "F", conjugeId: "jose" },
      { id: "graciele", nome: "Graciele", genero: "F", conjugeId: null },
      { id: "rosalia", nome: "Rosália", genero: "F", conjugeId: null },
      { id: "heloisa", nome: "Heloisa", genero: "F", conjugeId: null },
      { id: "rafaele", nome: "Rafaele", genero: "F", conjugeId: null },
      { id: "valdenice", nome: "Valdenice", genero: "F", conjugeId: null },
      { id: "kelly", nome: "Kelly", genero: "F", conjugeId: null },
      { id: "mariza", nome: "Mariza", genero: "F", conjugeId: null }
    ];

    function slotsFor(pairsInOrder) {
      var s = [], i = 0;
      HORARIOS.forEach(function (h) {
        s.push({ horario: h, local: "carrinho1", pair: pairsInOrder[i++] });
        s.push({ horario: h, local: "carrinho2", pair: pairsInOrder[i++] });
      });
      return s;
    }

    var schedules = {};
    schedules["2026-09"] = [
      { date: "2026-09-05", slots: slotsFor([["bruno","patrick"],["helena","emily"],["luciene","graciele"],["rosalia","heloisa"],["rafaele","valdenice"],["kelly","mariza"]]) },
      { date: "2026-09-12", slots: slotsFor([["heloisa","rafaele"],["valdenice","graciele"],["rosalia","kelly"],["helena","luciene"],["emily","mariza"],["jose","bruno"]]) },
      { date: "2026-09-19", slots: slotsFor([["mariza","rosalia"],["rafaele","luciene"],["jose","patrick"],["heloisa","kelly"],["valdenice","helena"],["graciele","emily"]]) },
      { date: "2026-09-26", slots: slotsFor([["luciene","jose"],["valdenice","emily"],["kelly","rafaele"],["mariza","helena"],["graciele","heloisa"],["patrick","bruno"]]) }
    ];

    return {
      people: people,
      config: { carrinho1: "Praça Central", carrinho2: "Praça da Feira" },
      schedules: schedules
    };
  }

  // ---------- estatísticas ----------
  function computeStats(excludeMonthKey) {
    var appear = {}, history = {}, lastIndex = {}, idx = 0;
    var keys = Object.keys(state.schedules).sort();
    keys.forEach(function (mk) {
      if (mk === excludeMonthKey) return;
      state.schedules[mk].forEach(function (day) {
        day.slots.forEach(function (slot) {
          if (!slot.pair) return;
          var a = slot.pair[0], b = slot.pair[1];
          appear[a] = (appear[a] || 0) + 1;
          appear[b] = (appear[b] || 0) + 1;
          var k = pairKey(a, b);
          history[k] = (history[k] || 0) + 1;
          lastIndex[a] = idx; lastIndex[b] = idx;
        });
        idx++;
      });
    });
    return { appear: appear, history: history, lastIndex: lastIndex, idx: idx };
  }

  function selectWorking(pool, needed, stats) {
    var arr = pool.slice();
    arr.sort(function (x, y) {
      var ax = stats.appear[x] || 0, ay = stats.appear[y] || 0;
      if (ax !== ay) return ax - ay;
      var lx = (stats.lastIndex[x] === undefined) ? -1 : stats.lastIndex[x];
      var ly = (stats.lastIndex[y] === undefined) ? -1 : stats.lastIndex[y];
      if (lx !== ly) return lx - ly;
      return Math.random() - 0.5;
    });
    return { working: arr.slice(0, needed), resting: arr.slice(needed) };
  }

  function greedyMatch(ids, history) {
    var pool = ids.slice(), pairs = [];
    while (pool.length > 1) {
      var best = null, bestScore = Infinity;
      for (var i = 0; i < pool.length; i++) {
        for (var j = i + 1; j < pool.length; j++) {
          var k = pairKey(pool[i], pool[j]);
          var score = (history[k] || 0) + Math.random() * 0.01;
          if (score < bestScore) { bestScore = score; best = [pool[i], pool[j]]; }
        }
      }
      pairs.push(best);
      pool = pool.filter(function (p) { return p !== best[0] && p !== best[1]; });
    }
    return pairs;
  }

  function planPairCounts(mCount, fCount, totalSlots) {
    var maxM = Math.floor(mCount / 2), maxF = Math.floor(fCount / 2);
    if (maxM + maxF <= totalSlots) return { m: maxM, f: maxF };
    var idealM = Math.round(totalSlots * mCount / (mCount + fCount || 1));
    var m = Math.min(idealM, maxM);
    var f = Math.min(totalSlots - m, maxF);
    var remaining = totalSlots - m - f;
    if (remaining > 0) { var addM = Math.min(remaining, maxM - m); m += addM; remaining -= addM; }
    if (remaining > 0) { var addF = Math.min(remaining, maxF - f); f += addF; remaining -= addF; }
    return { m: m, f: f };
  }

  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function generateMonth(year, month, absentIds) {
    var mk = monthKey(year, month);
    var saturdays = getSaturdays(year, month);
    var stats = computeStats(mk);
    var draft = [];
    var totalSlots = 2 * HORARIOS.length;

    saturdays.forEach(function (iso) {
      var available = state.people.filter(function (p) { return absentIds.indexOf(p.id) === -1; });
      var men = available.filter(function (p) { return p.genero === "M"; }).map(function (p) { return p.id; });
      var women = available.filter(function (p) { return p.genero === "F"; }).map(function (p) { return p.id; });
      var plan = planPairCounts(men.length, women.length, totalSlots);
      var wm = selectWorking(men, plan.m * 2, stats).working;
      var wf = selectWorking(women, plan.f * 2, stats).working;
      var malePairs = greedyMatch(wm, stats.history);
      var femalePairs = greedyMatch(wf, stats.history);
      var allPairs = shuffle(malePairs.concat(femalePairs));

      var slots = [], i = 0;
      HORARIOS.forEach(function (h) {
        slots.push({ horario: h, local: "carrinho1", pair: allPairs[i] || null }); i++;
        slots.push({ horario: h, local: "carrinho2", pair: allPairs[i] || null }); i++;
      });
      draft.push({ date: iso, slots: slots });

      slots.forEach(function (slot) {
        if (!slot.pair) return;
        var a = slot.pair[0], b = slot.pair[1];
        stats.appear[a] = (stats.appear[a] || 0) + 1;
        stats.appear[b] = (stats.appear[b] || 0) + 1;
        var k = pairKey(a, b);
        stats.history[k] = (stats.history[k] || 0) + 1;
        stats.lastIndex[a] = stats.idx; stats.lastIndex[b] = stats.idx;
      });
      stats.idx++;
    });

    return draft;
  }

  // ---------- persistência (Firestore) ----------
  function save() {
    return STATE_DOC.set(state).catch(function (e) {
      console.error("Falha ao salvar:", e);
      alert("Não consegui salvar os dados agora. Confira sua internet e tente de novo.");
    });
  }

  function load() {
    return STATE_DOC.get().then(function (snap) {
      if (snap.exists) {
        state = snap.data();
      } else {
        state = defaultState();
        return STATE_DOC.set(state);
      }
    });
  }

  // ---------- UI: cadastro ----------
  var draftSchedule = null;
  var draftMonthKey = null;

  function renderRoster() {
    var list = document.getElementById("roster-list");
    list.innerHTML = "";
    var men = state.people.filter(function (p) { return p.genero === "M"; }).length;
    var women = state.people.filter(function (p) { return p.genero === "F"; }).length;
    document.getElementById("roster-counts").innerHTML =
      "<span><b>" + men + "</b> irmão(s)</span><span><b>" + women + "</b> irmã(s)</span>";

    state.people.slice().sort(function (a, b) { return a.nome.localeCompare(b.nome, "pt-BR"); }).forEach(function (p) {
      var row = document.createElement("div");
      row.className = "person-row";
      var spouseTxt = "";
      if (p.conjugeId) {
        var sp = personById(p.conjugeId);
        spouseTxt = "casado(a) c/ " + (sp ? sp.nome : "?");
      }
      row.innerHTML =
        '<span class="tag' + (p.genero === "F" ? " f" : "") + '">' + (p.genero === "M" ? "Irmão" : "Irmã") + '</span>' +
        '<span class="name">' + p.nome + '</span>' +
        (spouseTxt ? '<span class="spouse">' + spouseTxt + '</span>' : '') +
        '<span class="actions"><button class="icon-btn" data-del="' + p.id + '" title="Remover">✕</button></span>';
      list.appendChild(row);
    });

    list.querySelectorAll("[data-del]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var id = btn.getAttribute("data-del");
        var p = personById(id);
        if (!confirm("Remover " + p.nome + " do cadastro?")) return;
        state.people = state.people.filter(function (x) { return x.id !== id; });
        state.people.forEach(function (x) { if (x.conjugeId === id) x.conjugeId = null; });
        save().then(function () { renderRoster(); renderConjugeOptions(); renderAbsenceList(); });
      });
    });
  }

  function renderConjugeOptions() {
    var sel = document.getElementById("new-conjuge");
    var genero = document.querySelector('input[name="new-genero"]:checked').value;
    var opposite = genero === "M" ? "F" : "M";
    sel.innerHTML = '<option value="">Nenhum</option>';
    state.people.filter(function (p) { return p.genero === opposite && !p.conjugeId; }).forEach(function (p) {
      var opt = document.createElement("option");
      opt.value = p.id; opt.textContent = p.nome;
      sel.appendChild(opt);
    });
  }

  function renderAbsenceList() {
    var box = document.getElementById("absence-list");
    box.innerHTML = "";
    state.people.slice().sort(function (a, b) { return a.nome.localeCompare(b.nome, "pt-BR"); }).forEach(function (p) {
      var chip = document.createElement("label");
      chip.className = "chip";
      chip.innerHTML = '<input type="checkbox" value="' + p.id + '"> ' + p.nome;
      box.appendChild(chip);
      chip.querySelector("input").addEventListener("change", function (e) {
        chip.classList.toggle("checked", e.target.checked);
      });
    });
  }

  document.querySelectorAll('input[name="new-genero"]').forEach(function (r) {
    r.addEventListener("change", renderConjugeOptions);
  });

  document.getElementById("btn-add-person").addEventListener("click", function () {
    var nomeInput = document.getElementById("new-nome");
    var nome = nomeInput.value.trim();
    if (!nome) { alert("Digite o nome."); return; }
    var genero = document.querySelector('input[name="new-genero"]:checked').value;
    var conjugeId = document.getElementById("new-conjuge").value || null;
    var id = uid(state.people.map(function (p) { return p.id; }), slugify(nome));
    state.people.push({ id: id, nome: nome, genero: genero, conjugeId: conjugeId || null });
    if (conjugeId) {
      var sp = personById(conjugeId);
      if (sp) sp.conjugeId = id;
    }
    nomeInput.value = "";
    document.getElementById("new-conjuge").value = "";
    save().then(function () { renderRoster(); renderConjugeOptions(); renderAbsenceList(); });
  });

  // ---------- UI: config ----------
  function renderConfig() {
    document.getElementById("cfg-carrinho1").value = state.config.carrinho1;
    document.getElementById("cfg-carrinho2").value = state.config.carrinho2;
  }
  document.getElementById("btn-save-config").addEventListener("click", function () {
    state.config.carrinho1 = document.getElementById("cfg-carrinho1").value.trim() || "Carrinho 1";
    state.config.carrinho2 = document.getElementById("cfg-carrinho2").value.trim() || "Carrinho 2";
    save().then(function () { if (draftSchedule) renderSchedule(); });
  });

  // ---------- UI: geração / escala ----------
  document.getElementById("btn-generate").addEventListener("click", function () {
    var val = document.getElementById("mes-input").value;
    if (!val) { alert("Escolha o mês."); return; }
    var parts = val.split("-");
    var year = parseInt(parts[0], 10), month = parseInt(parts[1], 10);
    var mk = monthKey(year, month);

    var warnEl = document.getElementById("generate-warn");
    warnEl.style.display = "none";

    if (state.schedules[mk]) {
      if (!confirm("Já existe uma programação salva para este mês. Gerar novamente vai criar um novo rascunho (só substitui o salvo quando você clicar em Salvar). Continuar?")) return;
    }

    var men = state.people.filter(function (p) { return p.genero === "M"; }).length;
    var women = state.people.filter(function (p) { return p.genero === "F"; }).length;
    if (men < 2 && women < 2) {
      warnEl.textContent = "Cadastre pelo menos duas pessoas do mesmo gênero para formar uma dupla.";
      warnEl.style.display = "block";
      return;
    }

    var absentIds = Array.prototype.slice.call(document.querySelectorAll("#absence-list input:checked")).map(function (i) { return i.value; });

    draftSchedule = generateMonth(year, month, absentIds);
    draftMonthKey = mk;
    renderSchedule();
  });

  function slotPairText(slot) {
    if (!slot.pair) return null;
    return personName(slot.pair[0]) + " / " + personName(slot.pair[1]);
  }

  function renderSchedule() {
    var card = document.getElementById("schedule-card");
    card.style.display = "block";
    var parts = draftMonthKey.split("-");
    var monthLabel = MESES[parseInt(parts[1], 10) - 1] + " DE " + parts[0];
    document.getElementById("schedule-title").textContent = "Programação — " + monthLabel;

    var container = document.getElementById("schedule-days");
    container.innerHTML = "";

    draftSchedule.forEach(function (day, dIdx) {
      var dc = document.createElement("div");
      dc.className = "day-card";
      var head = document.createElement("div");
      head.className = "day-head";
      head.innerHTML = "<span>Sábado " + fmtDateBR(day.date) + "</span>";
      dc.appendChild(head);

      var table = document.createElement("table");
      table.className = "slots";
      day.slots.forEach(function (slot, sIdx) {
        if (slot.local === "carrinho1") {
          var tr = document.createElement("tr");
          var tdH = document.createElement("td");
          tdH.className = "hora";
          tdH.textContent = slot.horario;
          tr.appendChild(tdH);

          [0, 1].forEach(function (off) {
            var s = day.slots[sIdx + off];
            var td = document.createElement("td");
            td.className = "pair" + (s.pair ? "" : " empty");
            var locName = s.local === "carrinho1" ? state.config.carrinho1 : state.config.carrinho2;
            td.innerHTML = '<span class="loc">' + locName + '</span><span class="p">' + (slotPairText(s) || "Vago — toque para definir") + '</span>';
            td.addEventListener("click", (function (dIdx, idx) {
              return function () { openEdit(dIdx, idx, td); };
            })(dIdx, sIdx + off));
            tr.appendChild(td);
          });
          table.appendChild(tr);
        }
      });
      dc.appendChild(table);
      container.appendChild(dc);
    });

    document.getElementById("saved-flag").textContent = state.schedules[draftMonthKey]
      ? "Existe uma versão salva deste mês. Salvar agora vai substituí-la."
      : "Este mês ainda não foi salvo.";
    document.getElementById("btn-delete-schedule").style.display = state.schedules[draftMonthKey] ? "inline-flex" : "none";
  }

  function openEdit(dayIndex, slotIndex, cellEl) {
    var old = document.querySelector(".edit-box");
    if (old) old.remove();

    var box = document.createElement("div");
    box.className = "edit-box";

    var options = state.people.slice().sort(function (a, b) { return a.nome.localeCompare(b.nome, "pt-BR"); });
    function optHtml(selectedId) {
      var h = '<option value="">— vago —</option>';
      options.forEach(function (p) {
        h += '<option value="' + p.id + '"' + (p.id === selectedId ? " selected" : "") + '>' + p.nome + '</option>';
      });
      return h;
    }

    var slot = draftSchedule[dayIndex].slots[slotIndex];
    var a = slot.pair ? slot.pair[0] : "";
    var b = slot.pair ? slot.pair[1] : "";

    box.innerHTML =
      '<div class="row2"><select id="edit-a">' + optHtml(a) + '</select><select id="edit-b">' + optHtml(b) + '</select></div>' +
      '<p class="warn" id="edit-warn" style="display:none;"></p>' +
      '<div class="btn-row"><button class="btn small" id="edit-confirm">Confirmar</button><button class="btn secondary small" id="edit-cancel">Cancelar</button></div>';

    cellEl.parentNode.parentNode.parentNode.appendChild(box);

    box.querySelector("#edit-cancel").addEventListener("click", function () { box.remove(); });
    box.querySelector("#edit-confirm").addEventListener("click", function () {
      var idA = box.querySelector("#edit-a").value;
      var idB = box.querySelector("#edit-b").value;
      var warn = box.querySelector("#edit-warn");
      warn.style.display = "none";

      if (!idA && !idB) {
        draftSchedule[dayIndex].slots[slotIndex].pair = null;
        box.remove(); renderSchedule(); return;
      }
      if (!idA || !idB || idA === idB) {
        warn.textContent = "Escolha duas pessoas diferentes.";
        warn.style.display = "block";
        return;
      }
      if (!validPair(idA, idB)) {
        warn.textContent = "Só homem com homem, mulher com mulher, ou casal registrado.";
        warn.style.display = "block";
        return;
      }
      var dup = false;
      draftSchedule[dayIndex].slots.forEach(function (s, i) {
        if (i === slotIndex || !s.pair) return;
        if (s.pair.indexOf(idA) !== -1 || s.pair.indexOf(idB) !== -1) dup = true;
      });
      if (dup) {
        if (!confirm("Uma dessas pessoas já está em outro horário/carrinho neste mesmo sábado. Usar mesmo assim?")) return;
      }
      draftSchedule[dayIndex].slots[slotIndex].pair = [idA, idB];
      box.remove();
      renderSchedule();
    });
  }

  document.getElementById("btn-save-schedule").addEventListener("click", function () {
    if (!draftSchedule) return;
    state.schedules[draftMonthKey] = draftSchedule;
    save().then(function () {
      renderSchedule();
      alert("Programação salva.");
    });
  });

  document.getElementById("btn-delete-schedule").addEventListener("click", function () {
    if (!confirm("Excluir a programação salva deste mês? Isso também afeta o rodízio calculado depois.")) return;
    delete state.schedules[draftMonthKey];
    save().then(function () {
      document.getElementById("btn-delete-schedule").style.display = "none";
      document.getElementById("saved-flag").textContent = "Este mês ainda não foi salvo.";
    });
  });

  // ---------- PDF ----------
  document.getElementById("btn-pdf").addEventListener("click", function () {
    if (!draftSchedule) return;
    var parts = draftMonthKey.split("-");
    var monthLabel = MESES[parseInt(parts[1], 10) - 1] + " DE " + parts[0];

    var jsPDFCtor = window.jspdf.jsPDF;
    var doc = new jsPDFCtor({ unit: "pt", format: "a4" });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("PROGRAMAÇÃO DO CARRINHO", 297, 40, { align: "center" });
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text(monthLabel, 297, 58, { align: "center" });

    var body = [];
    draftSchedule.forEach(function (day) {
      for (var h = 0; h < HORARIOS.length; h++) {
        var c1 = day.slots[h * 2], c2 = day.slots[h * 2 + 1];
        var row = [];
        if (h === 0) {
          row.push({ content: "SÁBADO\n" + fmtDateBR(day.date), rowSpan: 3, styles: { valign: "middle", fontStyle: "bold" } });
        }
        row.push(HORARIOS[h]);
        row.push(slotPairText(c1) || "—");
        row.push(slotPairText(c2) || "—");
        body.push(row);
      }
    });

    doc.autoTable({
      startY: 75,
      head: [["DATA", "HORÁRIO", state.config.carrinho1, state.config.carrinho2]],
      body: body,
      theme: "grid",
      styles: { font: "helvetica", fontSize: 10, cellPadding: 6, halign: "center", valign: "middle" },
      headStyles: { fillColor: [239, 235, 223], textColor: [34, 48, 42], fontStyle: "bold" }
    });

    var filename = "carrinho-" + draftMonthKey + ".pdf";
    var blob = doc.output("blob");

    if (navigator.canShare && (function () {
      try { return navigator.canShare({ files: [new File([blob], filename, { type: "application/pdf" })] }); }
      catch (e) { return false; }
    })()) {
      var file = new File([blob], filename, { type: "application/pdf" });
      navigator.share({ files: [file], title: "Programação do Carrinho", text: monthLabel }).catch(function () {
        doc.save(filename);
      });
    } else {
      doc.save(filename);
    }
  });

  // ---------- login / logout ----------
  document.getElementById("login-btn").addEventListener("click", function () {
    var email = document.getElementById("login-email").value.trim();
    var senha = document.getElementById("login-senha").value;
    var errEl = document.getElementById("login-error");
    errEl.style.display = "none";
    if (!email || !senha) { errEl.textContent = "Preencha e-mail e senha."; errEl.style.display = "block"; return; }
    auth.signInWithEmailAndPassword(email, senha).catch(function (e) {
      errEl.textContent = "Não consegui entrar: e-mail ou senha incorretos.";
      errEl.style.display = "block";
    });
  });

  document.getElementById("logout-btn").addEventListener("click", function () {
    auth.signOut();
  });

  // ---------- init ----------
  function setDefaultMonth() {
    var now = new Date();
    var y = now.getFullYear(), m = now.getMonth() + 2;
    if (m > 12) { m = 1; y += 1; }
    document.getElementById("mes-input").value = y + "-" + String(m).padStart(2, "0");
  }

  auth.onAuthStateChanged(function (user) {
    document.getElementById("loading-screen").style.display = "none";
    if (user) {
      document.getElementById("login-screen").style.display = "none";
      document.getElementById("app").style.display = "block";
      load().then(function () {
        renderRoster();
        renderConjugeOptions();
        renderConfig();
        renderAbsenceList();
        setDefaultMonth();
      });
    } else {
      document.getElementById("app").style.display = "none";
      document.getElementById("login-screen").style.display = "block";
    }
  });

})();
