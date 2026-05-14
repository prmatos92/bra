## Visão geral

Vamos construir um clone do site **brasil.futebolcard.com** — portal de venda de ingressos da Seleção Brasileira — com um **sistema próprio de ingressos** (sem usar a Futebol Card como gateway). O backend será **Firebase** (Auth + Firestore + Storage) e o build será **estático (SPA)** para subir no plano de hospedagem da **Hostinger** via File Manager / FTP.

## Decisões técnicas

- **Frontend**: TanStack Router em modo SPA (build estático). Vamos desligar o SSR e gerar `dist/` com `index.html` + assets, que é o que a Hostinger compartilhada serve.
- **Roteamento na Hostinger**: incluir `.htaccess` com rewrite para `index.html` (necessário para rotas tipo `/jogos/brasil-x-panama` funcionarem ao dar refresh).
- **Backend**: Firebase
  - Auth: e-mail/senha (cadastro e login do torcedor)
  - Firestore: coleções `matches`, `sectors`, `orders`, `tickets`, `users`
  - Storage: imagens dos jogos/banners (opcional, pode começar com URLs)
- **Idioma**: Português (BR)
- **Conteúdo inicial**: mock Brasil x Panamá (Maracanã/RJ — 31/05 18h30) já cadastrado via script de seed do Firestore.
- **Pagamento**: nesta primeira versão o checkout grava o pedido no Firestore com status `pending` e mostra um QR Pix mockado / "Pagamento em processamento". Integração real (Stripe/Pix) fica como passo seguinte.

## Páginas e rotas

```
src/routes/
  __root.tsx                    layout (header azul + footer)
  index.tsx                     home (busca + banner + card "Em breve")
  jogos.tsx                     listagem de todos os jogos
  jogos.$slug.tsx               detalhe do jogo + escolha de setor
  checkout.$orderId.tsx         resumo + pagamento mock
  meus-ingressos.tsx            (protegida) lista de ingressos do usuário
  login.tsx                     login
  cadastro.tsx                  cadastro
  ajuda.tsx                     FAQ estática
  termos.tsx / privacidade.tsx  páginas institucionais
```

Cada rota terá `head()` próprio (title, description, og:title) para SEO.

## Componentes principais

- `Header` — barra azul CBF com logo, busca "Procurando algum jogo?", ícone de usuário (login/perfil) e menu hambúrguer.
- `HeroBanner` — banner verde/amarelo "Bate no Peito" com escudos Brasil x Panamá, data e local.
- `MatchCard` — card branco "EM BREVE / À VENDA / ESGOTADO" com escudos, local e botão "Mais informações".
- `SectorPicker` — grid/mapa simplificado de setores do estádio com preços e disponibilidade.
- `AuthForms`, `OrderSummary`, `TicketCard` (ingresso com QR code).

## Design system

Tokens em `src/styles.css` (oklch) inspirados na identidade CBF:
- `--primary` azul CBF (~#1d3fff)
- `--accent` amarelo (~#ffd400)
- `--success` verde (~#009b3a)
- Tipografia: sans-serif arredondada (Poppins/Inter via Google Fonts).
- Cards brancos com sombra suave, bordas arredondadas (`--radius` 16px).

## Modelo de dados (Firestore)

```
matches/{matchId}
  slug, title, homeTeam, awayTeam, homeBadge, awayBadge,
  venue, city, datetime, status (em_breve|a_venda|esgotado),
  bannerUrl, sectors: [sectorId]

sectors/{sectorId}
  matchId, name, price, capacity, sold

orders/{orderId}
  userId, matchId, items:[{sectorId, qty, price}],
  total, status (pending|paid|cancelled), createdAt

tickets/{ticketId}
  orderId, userId, matchId, sectorId, code (uuid), used:boolean
```

Regras de segurança (Firestore Rules):
- `matches`/`sectors`: leitura pública, escrita só admin.
- `orders`/`tickets`: leitura/escrita só do próprio `userId` (`request.auth.uid`).

## Pacote de hospedagem Hostinger

No final entregaremos:
- `dist/` com build estático
- `dist/.htaccess` com rewrite SPA
- README com passo a passo: criar projeto Firebase, colar config em `.env`, rodar `bun run build`, fazer upload do conteúdo de `dist/` para `public_html` na Hostinger.

## Etapas de execução (em ordem)

1. **Setup base**: configurar SPA mode no `vite.config.ts`, instalar Firebase SDK, criar `src/lib/firebase.ts` com `import.meta.env.VITE_FIREBASE_*`.
2. **Design system**: aplicar tokens CBF em `src/styles.css`, importar fonte.
3. **Layout**: `__root.tsx` com Header azul + Footer; rota `index` com Hero + busca + grid de cards.
4. **Mock + seed**: arquivo `src/data/seed.ts` com Brasil x Panamá; helper para popular Firestore (botão admin oculto ou script).
5. **Páginas de jogo**: `/jogos` listagem, `/jogos/$slug` detalhes com `SectorPicker`.
6. **Auth**: `/login` e `/cadastro` usando Firebase Auth; contexto `AuthProvider`; rota guard `_authenticated/`.
7. **Checkout**: criar `order` no Firestore + tela de pagamento mock (QR Pix placeholder); ao "pagar" gera `tickets`.
8. **Meus ingressos**: lista os tickets do usuário com QR (lib `qrcode.react`).
9. **Páginas institucionais** (Ajuda, Termos, Privacidade) e SEO por rota.
10. **Build estático + `.htaccess`** + README de deploy Hostinger.

## Fora de escopo desta primeira entrega

- Pagamento real (Pix/cartão) — fica como gancho a integrar depois.
- Painel administrativo completo (cadastro de jogos via UI) — por enquanto via seed/console Firebase.
- App mobile / push notifications.

Se aprovado, começo pela etapa 1 (setup base + design system + layout + home com o card Brasil x Panamá), que já te dá um preview muito parecido com o original.