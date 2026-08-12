# Balcão de Publicações — passo a passo

App para você e o Diemerson anotarem pedidos de livros, Bíblias e brochuras,
sincronizado em tempo real entre os dois (sem depender de armazenamento
experimental — usa Firebase, a mesma base que você já usou no app de
RPV/precatório).

Tempo total: uns 15-20 minutos, só na primeira vez.

---

## 1. Criar o projeto no Firebase

1. Acesse https://console.firebase.google.com e entre com sua conta Google.
2. "Adicionar projeto" → nome (ex.: `balcao-publicacoes`) → pode desativar o
   Google Analytics (não precisa) → Criar projeto.
3. No menu lateral, clique em **Bancos de dados e armazenamento > Firestore**
   (o Google mudou esse menu recentemente — antes era "Build").
4. "Criar banco de dados" → edição **Standard** (não Enterprise, o gratuito é
   nessa) → Database ID: deixe `(default)` → região
   `southamerica-east1 (São Paulo)` → modo inicial das regras: qualquer um,
   porque no passo 2 abaixo você substitui pelas regras certas de qualquer
   forma.

## 2. Aplicar as regras de segurança

1. Ainda no Firestore, vá na aba **Regras**.
2. Apague o conteúdo e cole o que está no arquivo `firestore.rules` deste
   pacote.
3. Clique em **Publicar**.

Isso garante que só a coleção `pedidos` fica acessível — nada mais do seu
projeto Firebase fica exposto.

## 3. Pegar a configuração do app Web

1. No console do Firebase, clique no ícone de engrenagem (⚙) > **Configurações
   do projeto**.
2. Role até "Seus aplicativos" → clique no ícone `</>` (Web).
3. Dê um apelido (ex.: `balcao-web`) → **não** marque Firebase Hosting →
   Registrar app.
4. Vai aparecer um bloco de código com `const firebaseConfig = {...}`. Copie
   só os valores.
5. Abra o arquivo `firebase-config.js` deste pacote e substitua cada
   `"COLE_AQUI"` pelo valor correspondente.

## 4. Publicar no GitHub Pages

Mesma lógica que você já usou no app de RPV/precatório:

1. Crie um repositório novo no GitHub (ex.: `balcao-publicacoes`), pode ser
   público.
2. Suba **todos os arquivos deste pacote** pra raiz do repositório (`index.html`,
   `app.js`, `style.css`, `firebase-config.js` já preenchido, `manifest.json`,
   `sw.js`, os dois ícones `.png`).
3. No repositório: **Settings > Pages** → em "Source" escolha a branch
   `main` e pasta `/ (root)` → Save.
4. Em 1-2 minutos o GitHub mostra o link (algo como
   `https://seuusuario.github.io/balcao-publicacoes/`).

## 5. Instalar no celular (seu e do Diemerson)

1. Abra o link do GitHub Pages no navegador do celular.
2. iPhone: toque em Compartilhar → "Adicionar à Tela de Início".
   Android: menu do navegador → "Adicionar à tela inicial" / "Instalar app".
3. Pronto — abre como um app normal, com ícone próprio.

Repita esse passo no celular do Diemerson, com o mesmo link. Os dois vão
ver e editar a mesma lista, em tempo real, sem precisar de conta nem senha.

---

## Notas importantes

- **Sem tela de login de propósito**: qualquer pessoa com o link consegue ver
  e mexer nos pedidos. Pra um app interno, sem dado sensível, isso é
  aceitável — mas se um dia quiser travar com senha, é só avisar que eu
  adiciono autenticação simples.
- **Backup**: como é Firestore, dá pra exportar os dados a qualquer momento
  pelo próprio console do Firebase (Firestore > ⋮ > Exportar), do mesmo jeito
  que você fez backup no app de precatório.
- **Custo**: no volume de um balcão de publicações de salão, fica bem dentro
  do plano gratuito (Spark) do Firebase.
- **Se quiser mudar algo depois** (campos do formulário, cores, adicionar
  filtro por congregação etc.), é só me chamar com o arquivo `app.js` em mãos.
