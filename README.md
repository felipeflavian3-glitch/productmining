# Garimpo: mineração de produtos (Amazon US → China → FBA)

Sistema que coleta todo dia os Top 100 da Amazon US (categorias e subcategorias), guarda o histórico e dá uma **nota de oportunidade de 0 a 100** para cada produto, pensando em importar da China e vender via FBA.

```
coletor/   → robô que lê as listas da Amazon (Node + Playwright)
painel/    → site com o ranking e a ficha de cada produto (Next.js)
supabase/  → estrutura do banco de dados
.github/   → agenda que roda o coletor todo dia de graça
```

## Como a nota é calculada

| Parte | Pontos | Lógica |
|---|---|---|
| Demanda | até 30 | Vendas/mês estimadas pelo ranking (300/mês = 0, 10.000+/mês = 30) |
| Concorrência | até 25 | Menos reviews = mais fácil de entrar (<100 reviews = 25) |
| Tendência | até 20 | Subida no ranking vs. até 7 dias atrás, entrou na lista agora, está em Lançamentos |
| Faixa de preço | até 15 | US$ 20-70 ideal; **abaixo de US$ 12 perde pontos** (a FBA come a margem) |
| Espaço p/ melhorar | até 10 | Avaliação 3,5-4,3 = clientes reclamando = chance de fazer melhor |
| Riscos | negativo | Marca forte (−15), categorias com certificação ou devolução alta (−5 a −12) |

Os pesos ficam em `coletor/src/nota.js`. As categorias, as marcas fortes e a profundidade da coleta ficam em `coletor/src/config.js`.

**Importante:** "vendas/mês" é uma estimativa feita a partir do ranking, porque a Amazon não divulga vendas. Serve para comparar produtos entre si, não para planejar estoque. Antes de comprar, valide com outras fontes.

---

## Colocando no ar (passo a passo, tudo grátis)

### 1. Supabase (banco de dados)
1. Crie uma conta em https://supabase.com e clique em **New project** (região: *East US*).
2. No projeto, vá em **SQL Editor → New query**, cole todo o conteúdo de `supabase/schema.sql` e clique em **Run**.
3. Em **Project Settings → API**, copie:
   - **Project URL** → vai ser o `SUPABASE_URL`
   - **service_role key** (em "Project API keys", clique em *Reveal*) → vai ser o `SUPABASE_SERVICE_KEY`

   ⚠️ A service_role key dá acesso total ao banco. Nunca coloque em código nem mande por WhatsApp; só nos campos de "secrets" abaixo.

### 2. GitHub (coleta automática diária)
1. Crie uma conta em https://github.com e um repositório **privado** chamado `garimpo`.
2. Envie esta pasta para o repositório (no terminal, dentro de `Mineração de Produtos`):
   ```bash
   git init
   git add .
   git commit -m "Garimpo fase 1"
   git branch -M main
   git remote add origin https://github.com/SEU-USUARIO/garimpo.git
   git push -u origin main
   ```
3. No repositório: **Settings → Secrets and variables → Actions → New repository secret**. Crie dois:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_KEY`
4. Vá em **Actions → Coleta diária Amazon → Run workflow** para rodar a primeira vez. Depois ela roda sozinha todo dia às 8h (Brasília).

A coleta completa leva uns 55 minutos por dia, cerca de 1.650 dos 2.000 minutos grátis por mês do GitHub em repositório privado.

### 3. Vercel (o painel online)
1. Crie uma conta em https://vercel.com entrando com o GitHub.
2. **Add New → Project** → escolha o repositório `garimpo`.
3. Em **Root Directory**, escolha `painel`.
4. Em **Environment Variables**, adicione:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_KEY`
   - `PAINEL_SENHA`: a senha que você e seu sócio vão usar para entrar (o usuário pode ser qualquer coisa)
5. **Deploy**. Mande o link e a senha para o seu sócio.

---

## Rodando no seu PC (teste)

```bash
cd coletor
npm install
npx playwright install chromium
npm run teste
```
O comando grava em `coletor/data/local.json`. Depois:
```bash
cd ../painel
npm install
npm run dev
```
Abra http://localhost:3010. Sem as variáveis do Supabase, o painel lê o arquivo local.

Opções do coletor: `--categorias=kitchen,pet-supplies`, `--subcats=8`, `--paginas=2`, `--listas=bestsellers,new`, `--local`.

---

## Limites conhecidos

- **Bloqueio da Amazon:** o coletor é lento de propósito e para sozinho depois de 3 captchas, salvando o que já leu. Se o GitHub começar a ser bloqueado com frequência (a aba Actions vai mostrar ⚠ captcha), dá para rodar o coletor no seu PC com o Agendador de Tarefas do Windows.
- **Termos de uso:** os termos da Amazon proíbem coleta automatizada. O volume aqui é baixo (cerca de 400 páginas por dia, só listas públicas), mas o risco existe e é seu.
- **Movers & Shakers e Most Wished For:** em nov/2026 essas listas vinham vazias para visitante sem login. A tendência é calculada pelo próprio histórico do sistema.
- **Histórico começa do zero:** os gráficos e a tendência ficam bons depois de 1 a 2 semanas de coleta.

## Próximas fases
- **Fase 2:** TikTok Shop (Creative Center) + calculadora de margem FBA (custo China + frete + imposto + taxas) + fornecedores.
- **Fase 3:** alertas no Telegram + login individual para cada sócio.
