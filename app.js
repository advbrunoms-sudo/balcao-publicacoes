import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  enableIndexedDbPersistence,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

// ---------- Firebase ----------
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

try {
  // permite que o app funcione (leitura de dados já carregados) mesmo sem internet
  enableIndexedDbPersistence(db);
} catch (e) {
  console.warn("Persistência offline não pôde ser ativada:", e);
}

const TIPOS = [
  { valor: "Bíblia", letra: "B", cor: "#2F4858" },
  { valor: "Livro", letra: "L", cor: "#6B4A2E" },
  { valor: "Brochura", letra: "H", cor: "#8B6A2E" },
  { valor: "Revista", letra: "R", cor: "#5B4B7A" },
  { valor: "Outro", letra: "O", cor: "#5B5142" },
];
const ANOTADORES = ["Bruno", "Diemerson"];

// ---------- Estado ----------
let pedidos = [];
let filtro = "pendentes";
let busca = "";
let confirmExcluirId = null;
let duplicatasEncontradas = null;
let formVisivel = false;
let carregouUmaVez = false;
let form = { nome: "", tipo: "Livro", titulo: "", quantidade: 1, anotadoPor: "", obs: "" };

// ---------- Elementos ----------
const el = {
  contPendentes: document.getElementById("cont-pendentes"),
  contEntregues: document.getElementById("cont-entregues"),
  avisoOffline: document.getElementById("aviso-offline"),
  botaoNovo: document.getElementById("botao-novo"),
  formCard: document.getElementById("form-card"),
  form: document.getElementById("form-pedido"),
  campoNome: document.getElementById("campo-nome"),
  campoTipo: document.getElementById("campo-tipo"),
  campoQuantidade: document.getElementById("campo-quantidade"),
  campoTitulo: document.getElementById("campo-titulo"),
  campoAnotadoPor: document.getElementById("campo-anotado-por"),
  campoObs: document.getElementById("campo-obs"),
  botaoCancelarForm: document.getElementById("botao-cancelar-form"),
  blocoDuplicado: document.getElementById("bloco-duplicado"),
  duplicadoTexto: document.getElementById("duplicado-texto"),
  duplicadoLista: document.getElementById("duplicado-lista"),
  botaoCadastrarMesmoAssim: document.getElementById("botao-cadastrar-mesmo-assim"),
  botaoRevisarPedido: document.getElementById("botao-revisar-pedido"),
  blocoBotoesForm: document.getElementById("bloco-botoes-form"),
  inputBusca: document.getElementById("input-busca"),
  tabs: document.querySelectorAll(".tab"),
  avisoErro: document.getElementById("aviso-erro"),
  textoErro: document.getElementById("texto-erro"),
  botaoTentarNovamente: document.getElementById("botao-tentar-novamente"),
  lista: document.getElementById("lista"),
  vazio: document.getElementById("vazio"),
};

// ---------- Utilitários ----------
function normaliza(txt) {
  return (txt || "").trim().toLowerCase();
}

function formatarData(valor) {
  if (!valor) return "agora";
  const d = typeof valor.toDate === "function" ? valor.toDate() : new Date(valor);
  return (
    d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" }) +
    " " +
    d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
  );
}

function tipoInfo(tipo) {
  return TIPOS.find((t) => t.valor === tipo) || TIPOS[TIPOS.length - 1];
}

// ---------- Firestore: escuta em tempo real ----------
const colRef = collection(db, "pedidos");
const q = query(colRef, orderBy("criadoEm", "desc"));

onSnapshot(
  q,
  (snapshot) => {
    pedidos = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    carregouUmaVez = true;
    el.avisoErro.classList.add("oculto");
    render();
  },
  (erro) => {
    console.error("Erro na sincronização com o Firestore:", erro);
    mostrarErro(
      carregouUmaVez
        ? "Sem conexão com o servidor no momento. Os pedidos aparecerão assim que a conexão voltar."
        : `Não consegui conectar ao banco de dados (${erro.message}). Confira o firebase-config.js e as regras do Firestore.`
    );
  }
);

function mostrarErro(msg) {
  el.textoErro.textContent = msg;
  el.avisoErro.classList.remove("oculto");
}

// ---------- Ações no Firestore ----------
async function criarPedido() {
  try {
    await addDoc(colRef, {
      nome: form.nome.trim(),
      tipo: form.tipo,
      titulo: form.titulo.trim(),
      quantidade: Math.max(1, Number(form.quantidade) || 1),
      anotadoPor: form.anotadoPor,
      obs: form.obs.trim(),
      status: "pendente",
      criadoEm: serverTimestamp(),
      entregueEm: null,
    });
    limparForm();
    formVisivel = false;
    render();
  } catch (e) {
    console.error("Erro ao criar pedido:", e);
    mostrarErro(`Não consegui salvar o pedido (${e.message}).`);
  }
}

async function darBaixa(id) {
  try {
    await updateDoc(doc(db, "pedidos", id), { status: "entregue", entregueEm: serverTimestamp() });
  } catch (e) {
    console.error("Erro ao dar baixa:", e);
    mostrarErro(`Não consegui dar baixa nesse pedido (${e.message}).`);
  }
}

async function reverter(id) {
  try {
    await updateDoc(doc(db, "pedidos", id), { status: "pendente", entregueEm: null });
  } catch (e) {
    console.error("Erro ao reverter:", e);
    mostrarErro(`Não consegui reverter esse pedido (${e.message}).`);
  }
}

async function excluir(id) {
  try {
    await deleteDoc(doc(db, "pedidos", id));
    confirmExcluirId = null;
  } catch (e) {
    console.error("Erro ao excluir:", e);
    mostrarErro(`Não consegui excluir esse pedido (${e.message}).`);
  }
}

// ---------- Formulário ----------
function limparForm() {
  form = { nome: "", tipo: "Livro", titulo: "", quantidade: 1, anotadoPor: "", obs: "" };
  duplicatasEncontradas = null;
}

function buscarDuplicatas(nome, titulo) {
  return pedidos.filter(
    (p) => normaliza(p.nome) === normaliza(nome) && normaliza(p.titulo) === normaliza(titulo)
  );
}

function sincronizarCamposDom() {
  el.campoNome.value = form.nome;
  el.campoTipo.value = form.tipo;
  el.campoQuantidade.value = form.quantidade;
  el.campoTitulo.value = form.titulo;
  el.campoAnotadoPor.value = form.anotadoPor;
  el.campoObs.value = form.obs;
}

el.botaoNovo.addEventListener("click", () => {
  formVisivel = true;
  sincronizarCamposDom();
  render();
  el.campoNome.focus();
});

el.botaoCancelarForm.addEventListener("click", () => {
  formVisivel = false;
  limparForm();
  sincronizarCamposDom();
  render();
});

[el.campoNome, el.campoTipo, el.campoQuantidade, el.campoTitulo, el.campoAnotadoPor, el.campoObs].forEach(
  (campo) => {
    campo.addEventListener("input", () => {
      duplicatasEncontradas = null;
      el.blocoDuplicado.classList.add("oculto");
      el.blocoBotoesForm.classList.remove("oculto");
    });
  }
);

el.form.addEventListener("submit", (e) => {
  e.preventDefault();
  form.nome = el.campoNome.value;
  form.tipo = el.campoTipo.value;
  form.quantidade = el.campoQuantidade.value;
  form.titulo = el.campoTitulo.value;
  form.anotadoPor = el.campoAnotadoPor.value;
  form.obs = el.campoObs.value;

  if (!form.nome.trim() || !form.titulo.trim() || !form.anotadoPor) return;

  const achados = buscarDuplicatas(form.nome, form.titulo);
  if (achados.length > 0) {
    duplicatasEncontradas = achados;
    renderDuplicados();
    return;
  }
  criarPedido();
});

el.botaoCadastrarMesmoAssim.addEventListener("click", () => criarPedido());
el.botaoRevisarPedido.addEventListener("click", () => {
  duplicatasEncontradas = null;
  el.blocoDuplicado.classList.add("oculto");
  el.blocoBotoesForm.classList.remove("oculto");
});

function renderDuplicados() {
  if (!duplicatasEncontradas) {
    el.blocoDuplicado.classList.add("oculto");
    el.blocoBotoesForm.classList.remove("oculto");
    return;
  }
  el.blocoBotoesForm.classList.add("oculto");
  el.blocoDuplicado.classList.remove("oculto");
  el.duplicadoTexto.textContent = `${form.nome.trim()} já pediu "${form.titulo.trim()}" antes:`;
  el.duplicadoLista.innerHTML = duplicatasEncontradas
    .map((d) =>
      d.status === "entregue"
        ? `<li>Entregue em ${formatarData(d.entregueEm)}</li>`
        : `<li>Pendente desde ${formatarData(d.criadoEm)}</li>`
    )
    .join("");
}

// ---------- Busca e abas ----------
el.inputBusca.addEventListener("input", (e) => {
  busca = e.target.value;
  render();
});

el.tabs.forEach((btn) => {
  btn.addEventListener("click", () => {
    filtro = btn.dataset.filtro;
    render();
  });
});

el.botaoTentarNovamente.addEventListener("click", () => {
  el.avisoErro.classList.add("oculto");
});

// ---------- Render ----------
function listaFiltrada() {
  let lista = pedidos;
  if (filtro === "pendentes") lista = lista.filter((p) => p.status === "pendente");
  if (filtro === "entregues") lista = lista.filter((p) => p.status === "entregue");

  const termo = normaliza(busca);
  if (termo) {
    lista = lista.filter(
      (p) => normaliza(p.nome).includes(termo) || normaliza(p.titulo).includes(termo)
    );
  }
  return lista;
}

function render() {
  el.formCard.classList.toggle("oculto", !formVisivel);
  el.botaoNovo.classList.toggle("oculto", formVisivel);

  if (formVisivel) {
    renderDuplicados();
  }

  el.tabs.forEach((btn) => btn.classList.toggle("ativa", btn.dataset.filtro === filtro));

  const totalPendentes = pedidos.filter((p) => p.status === "pendente").length;
  const totalEntregues = pedidos.filter((p) => p.status === "entregue").length;
  el.contPendentes.textContent = totalPendentes;
  el.contEntregues.textContent = totalEntregues;

  const lista = listaFiltrada();
  lista.sort((a, b) => {
    if (filtro === "entregues") {
      return dataMs(b.entregueEm) - dataMs(a.entregueEm);
    }
    return dataMs(a.criadoEm) - dataMs(b.criadoEm);
  });

  if (!carregouUmaVez) {
    el.vazio.textContent = "Carregando pedidos...";
    el.vazio.classList.remove("oculto");
    el.lista.innerHTML = "";
    return;
  }

  if (lista.length === 0) {
    el.vazio.textContent =
      filtro === "pendentes"
        ? 'Nenhum pedido pendente. Toque em "Novo pedido" para começar.'
        : filtro === "entregues"
        ? "Nenhum pedido entregue ainda."
        : "Nenhum pedido registrado.";
    el.vazio.classList.remove("oculto");
    el.lista.innerHTML = "";
    return;
  }

  el.vazio.classList.add("oculto");
  el.lista.innerHTML = lista.map((p) => cardHtml(p)).join("");

  el.lista.querySelectorAll("[data-baixa]").forEach((b) =>
    b.addEventListener("click", () => darBaixa(b.dataset.baixa))
  );
  el.lista.querySelectorAll("[data-reverter]").forEach((b) =>
    b.addEventListener("click", () => reverter(b.dataset.reverter))
  );
  el.lista.querySelectorAll("[data-excluir]").forEach((b) =>
    b.addEventListener("click", () => {
      confirmExcluirId = b.dataset.excluir;
      render();
    })
  );
  el.lista.querySelectorAll("[data-excluir-sim]").forEach((b) =>
    b.addEventListener("click", () => excluir(b.dataset.excluirSim))
  );
  el.lista.querySelectorAll("[data-excluir-nao]").forEach((b) =>
    b.addEventListener("click", () => {
      confirmExcluirId = null;
      render();
    })
  );
}

function dataMs(valor) {
  if (!valor) return 0;
  const d = typeof valor.toDate === "function" ? valor.toDate() : new Date(valor);
  return d.getTime();
}

function cardHtml(p) {
  const info = tipoInfo(p.tipo);
  const carimbo = p.status === "entregue" ? `<div class="carimbo">ENTREGUE</div>` : "";
  const obs = p.obs ? `<div class="card-obs">${escapeHtml(p.obs)}</div>` : "";
  const qtd = p.quantidade > 1 ? ` (${p.quantidade}x)` : "";
  const metaEntrega = p.status === "entregue" && p.entregueEm ? ` · entregue em ${formatarData(p.entregueEm)}` : "";

  const botaoAcao =
    p.status === "pendente"
      ? `<button class="botao-baixa" data-baixa="${p.id}">Dar baixa</button>`
      : `<button class="botao-reverter" data-reverter="${p.id}">Reverter</button>`;

  const botaoExcluir =
    confirmExcluirId === p.id
      ? `<span class="confirmar-linha">
           <span class="confirmar-texto">Excluir?</span>
           <button class="botao-confirmar-sim" data-excluir-sim="${p.id}">Sim</button>
           <button class="botao-confirmar-nao" data-excluir-nao="${p.id}">Não</button>
         </span>`
      : `<button class="botao-excluir" data-excluir="${p.id}">Excluir</button>`;

  return `
    <div class="card">
      <div class="furo f1"></div>
      <div class="furo f2"></div>
      <div class="aba" style="background:${info.cor}">${info.letra}</div>
      ${carimbo}
      <div class="card-conteudo">
        <div class="card-nome">${escapeHtml(p.nome)}</div>
        <div class="card-publicacao">${escapeHtml(p.tipo)} — ${escapeHtml(p.titulo)}${qtd}</div>
        ${obs}
        <div class="card-meta">Pedido em ${formatarData(p.criadoEm)}${p.anotadoPor ? ` · anotado por ${escapeHtml(p.anotadoPor)}` : ""}${metaEntrega}</div>
        <div class="card-botoes">${botaoAcao}${botaoExcluir}</div>
      </div>
    </div>`;
}

function escapeHtml(txt) {
  const d = document.createElement("div");
  d.textContent = txt || "";
  return d.innerHTML;
}

// ---------- Aviso de offline do navegador ----------
function atualizarAvisoOffline() {
  el.avisoOffline.classList.toggle("oculto", navigator.onLine);
}
window.addEventListener("online", atualizarAvisoOffline);
window.addEventListener("offline", atualizarAvisoOffline);
atualizarAvisoOffline();

render();

// ---------- Service worker (PWA) ----------
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch((e) => console.warn("Service worker não registrado:", e));
  });
}
