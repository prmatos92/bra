# Brasil — Ingressos da Seleção (clone)

Site clone do `brasil.futebolcard.com` com **sistema próprio de ingressos**, backend em **Firebase** (Auth + Firestore) e pacote pronto para a **Hostinger**.

## Stack
- TanStack Router + Vite + React 19 + Tailwind v4
- Firebase Web SDK (Auth + Firestore)
- `qrcode.react` para os QR Codes dos ingressos

## Configuração do Firebase
1. Acesse https://console.firebase.google.com → **Adicionar projeto**
2. Em **Build → Authentication**, ative o provedor **E-mail/Senha**
3. Em **Build → Firestore Database**, crie um banco em modo **production** (ajuste regras logo abaixo)
4. Em **Project settings → Your apps**, adicione um app **Web** e copie a config
5. Crie um arquivo `.env` na raiz (use `.env.example` como base) e preencha:
   ```env
   VITE_FIREBASE_API_KEY=...
   VITE_FIREBASE_AUTH_DOMAIN=...
   VITE_FIREBASE_PROJECT_ID=...
   VITE_FIREBASE_STORAGE_BUCKET=...
   VITE_FIREBASE_MESSAGING_SENDER_ID=...
   VITE_FIREBASE_APP_ID=...
   ```

### Regras sugeridas do Firestore
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /orders/{id} {
      allow read, write: if request.auth != null
        && request.auth.uid == resource.data.userId;
      allow create: if request.auth != null
        && request.auth.uid == request.resource.data.userId;
    }
    match /tickets/{id} {
      allow read: if request.auth != null
        && request.auth.uid == resource.data.userId;
      allow create, update: if request.auth != null
        && request.auth.uid == request.resource.data.userId;
    }
  }
}
```

## Rodando local
```bash
bun install
bun run dev
```

## Deploy na Hostinger (hospedagem compartilhada)
A Hostinger compartilhada serve apenas arquivos estáticos. Faça o build e suba o conteúdo de `dist/` para `public_html`.

```bash
bun run build
```

Depois:
1. Acesse o **hPanel** da Hostinger → **File Manager** (ou conecte via FTP)
2. Vá até a pasta `public_html` do seu domínio
3. Faça upload de **todo o conteúdo** da pasta `dist/` gerada (não a pasta em si, mas os arquivos dentro dela)
4. Confira que o arquivo `.htaccess` foi enviado (ele garante que rotas como `/jogos/brasil-x-panama` funcionem ao dar refresh)

> Em hospedagens onde o `.htaccess` é desabilitado, peça ao suporte da Hostinger para habilitar `mod_rewrite` no domínio.

## Estrutura
```
src/
├── routes/                # páginas (TanStack Router)
│   ├── __root.tsx
│   ├── index.tsx          # home
│   ├── jogos.tsx          # listagem
│   ├── jogos.$slug.tsx    # detalhes + escolha de setor
│   ├── checkout.$orderId.tsx
│   ├── meus-ingressos.tsx
│   ├── login.tsx / cadastro.tsx
│   └── ajuda.tsx / termos.tsx / privacidade.tsx
├── components/            # Header, Footer, MatchCard, CbfLogo
├── lib/                   # firebase, auth-context, orders, types
└── data/matches.ts        # mock dos jogos (Brasil x Panamá etc.)
```

## Próximos passos sugeridos
- Trocar o pagamento "demo" por um gateway real (Mercado Pago Pix / Stripe)
- Painel administrativo para cadastrar jogos via UI (hoje os jogos vêm de `src/data/matches.ts`)
- Notificações por e-mail após confirmar pagamento (Cloud Functions + SendGrid)
