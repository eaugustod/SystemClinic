# ClinicFlow — Sistema de Gestão Clínica

Projeto reestruturado a partir do `index.html` original (~19.000 linhas, ~1MB).

## 📁 Estrutura do Projeto

```
clinicflow/
├── index.html                    ← HTML puro (sem CSS ou JS inline)
├── README.md
└── assets/
    ├── css/
    │   ├── variables.css         ← Design tokens (:root)
    │   ├── base.css              ← Reset & body
    │   ├── login.css             ← Tela de login
    │   ├── layout.css            ← Sidebar, topbar, pages
    │   ├── conecta.css           ← Espaço Conecta (salas)
    │   ├── agenda.css            ← Agenda, week/month view
    │   ├── components.css        ← Cards, tabelas, badges
    │   ├── forms.css             ← Forms, modais, planos, TISS
    │   └── modules.css           ← Toast, scrollbar, WhatsApp, Import, Print, Grupo, Bloqueio, Perfis
    │
    └── js/
        ├── store.js              ← Estado global (CLINICA, PACIENTES, APPOINTMENTS…)
        ├── utils.js              ← Helpers: color picker, foto, toast
        ├── db.js                 ← Supabase client + loadFromSupabase + sincronizar
        ├── auth.js               ← Login, logout, permissões de perfil
        ├── ui.js                 ← Navegação, init, refresh central, temas
        ├── selects.js            ← Populate selects, modal tabs, auto-fill
        ├── dashboard.js          ← KPIs e dados dinâmicos do dashboard
        ├── relatorios.js         ← Relatórios por período
        ├── agenda.js             ← Day view, month view, abrir agendamento
        ├── drag_drop.js          ← Drag & Drop da agenda
        ├── tables.js             ← CRUD tabelas (pacientes, profissionais, guias…)
        ├── modals.js             ← Abertura/fechamento de modais, salvar agendamento, grupo
        ├── tiss.js               ← SADT, logos planos, exec procs, impressão
        ├── guias_auto.js         ← Geração automática de guias
        ├── feriados.js           ← Cadastro de feriados
        ├── historico.js          ← Prontuário, linha do tempo, evoluções, anamnese
        ├── importar_evolucoes.js ← Importação de evoluções via Google Sheets
        ├── espera.js             ← Lista de espera
        ├── senhas.js             ← Senhas/autorizações por plano
        ├── whatsapp.js           ← Módulo WhatsApp completo
        ├── importacao.js         ← Central de importação (CSV)
        ├── perfis.js             ← Perfis de acesso personalizados
        ├── bloqueio.js           ← Bloqueio de agenda
        ├── fechamento.js         ← Fechamento mensal
        ├── conecta_salas.js      ← Espaço Conecta (locação de salas)
        └── chat.js               ← Chat com pacientes (painel em nova aba)
```

## 🚀 Como usar

1. Faça download e extraia todos os arquivos mantendo a estrutura de pastas
2. Abra `index.html` em um servidor local (não funciona via `file://` por causa dos scripts externos)
3. Para desenvolvimento local, use:
   ```bash
   # Python
   python3 -m http.server 8080
   
   # Node.js
   npx serve .
   
   # VS Code
   Instale a extensão "Live Server" e clique em "Open with Live Server"
   ```

## ⚙️ Configuração Supabase

As credenciais do Supabase são configuradas em **Configurações** dentro do sistema, ou via `localStorage`:

```javascript
localStorage.setItem('cf_supa_url', 'https://seu-projeto.supabase.co');
localStorage.setItem('cf_supa_key', 'sua-anon-key');
```

## 📋 Ordem de carregamento dos scripts

A ordem dos `<script>` no `index.html` é importante:

1. **SDK Supabase** — dependência externa
2. **store.js** — estado global (sem dependências)
3. **utils.js** — helpers (sem dependências)
4. **db.js** — usa `window.supabase` do SDK
5. **auth.js** — usa `store.js` e `db.js`
6. **ui.js** — usa tudo acima
7. **Módulos de feature** — usam tudo acima
8. *(não há app.js separado — a inicialização é feita pelo `window.onload` dentro de `ui.js`)*

## 🔧 Manutenção

- Para alterar cores/temas: edite `assets/css/variables.css`
- Para alterar o layout principal: edite `assets/css/layout.css`
- Para alterar lógica de agendamento: edite `assets/js/agenda.js`
- Para alterar integração com Supabase: edite `assets/js/db.js`
- Para alterar autenticação: edite `assets/js/auth.js`

