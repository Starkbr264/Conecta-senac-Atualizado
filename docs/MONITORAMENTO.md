# Monitoramento pós-deploy da API (Conecta-Senac)

Monitoramento contínuo do endpoint de saúde da API publicada:

```
GET https://conecta-senac-test.onrender.com/health
```

A verificação **não considera apenas HTTP 200**: o corpo da resposta precisa ser
JSON válido com `"status": "UP"`. Qualquer desvio é tratado como indisponibilidade.

## 1. Visão geral

| Item | Valor |
|------|-------|
| Solução | **GitHub Actions** (`.github/workflows/monitor-api.yml`) |
| Intervalo | a cada **15 minutos** (`cron: '*/15 * * * *'`) + execução manual (`workflow_dispatch`) |
| Núcleo | `scripts/monitor/check-health.mjs` (Node 18+, **zero dependências**) |
| Testes | `scripts/monitor/check-health.test.mjs` (`node:test`) |
| Notificação | **GitHub Issues** — 1 issue aberta por falha, edição silenciosa durante a falha, comentário + fecho na recuperação |
| Custo | **gratuito** (repositório público: Actions e Issues sem custo) |
| Segredos | **nenhum** — só o `GITHUB_TOKEN` automático do Actions |

### Fluxo por execução

```
schedule (15 min) ou workflow_dispatch
  └─ job "teste": node --test (regressão do monitor)
  └─ job "monitorar" (precisa do teste verde)
       1. GET /health (timeout 120 s, até 2 tentativas com 15 s de intervalo)
       2. classifica: UP | UNAVAILABLE | TIMEOUT | UNEXPECTED
       3. grava JSON do resultado (data, horário, duração, HTTP, resultado, detalhe)
       4. publica tabela no "job summary" + artefato (30 dias)
       5. notifica via Issues (matriz abaixo) — só 1 notificação por falha
       6. deixa o job VERDE (UP) ou VERMELHO (falha)
```

### Matriz de notificação (dedup)

| Resultado | Issue `monitoramento` aberta? | Ação | Notifica? |
|-----------|------------------------------|------|-----------|
| falha | não | **criar** issue | sim (1ª notificação) |
| falha | sim | **atualizar** corpo da issue (`gh issue edit`) | **não** (edição é silenciosa) |
| `UP` | sim | **comentar** + **fechar** a issue | sim (1 notificação de recuperação) |
| `UP` | não | nenhuma | não |

Assim, uma falha continua gera **exatamente uma** notificação de indisponibilidade
e **exatamente uma** de recuperação, por episódio.

### Classificação dos resultados

| Resultado | Condição |
|-----------|----------|
| `UP` | HTTP 200 **e** JSON válido **e** campo `status === "UP"` |
| `UNAVAILABLE` | HTTP ≠ 200 (404/500/503…) ou falha de conexão (DNS, recusada…) |
| `TIMEOUT` | tempo esgotado (`AbortSignal.timeout`, 120 s por tentativa) |
| `UNEXPECTED` | HTTP 200 mas corpo inesperado: não-JSON, JSON sem `status`, ou `status` ≠ `"UP"` |

## 2. Por que GitHub Actions? (justificativa)

| Alternativa | Por que não |
|-------------|-------------|
| **GitHub Actions** ✅ | Já usado no repositório (`.github/workflows/ci.yml`), grátis em repo público, agendamento nativo, **sem conta/segredo novo**, logs + resumo + artefatos por execução, validação de JSON precisa (script próprio) e notificação nativa via Issues. |
| UptimeRobot /同类 serviços de uptime | Conta externa nova; validação de corpo limitada a palavra-chave; sem integração nativa de issues; mais um painel para gerenciar. |
| cron-job.org | Conta externa; armazenamento de log limitado; sem dedup/notificação integrada ao repositório. |
| Healthchecks.io | Padrão inverso (serve para avisar que *seu cron* parou), não para sondar um endpoint HTTP com validação de JSON. |
| Script em servidor próprio | Exige infraestrutura paga/própria; exatamente o que o Actions elimina. |

## 3. Arquivos

```
.github/workflows/monitor-api.yml   # agendamento, jobs e notificação (gh CLI)
scripts/monitor/check-health.mjs    # núcleo testável: classificar, tentar, decidir, gerar markdown
scripts/monitor/check-health.test.mjs # 20 testes (node:test, sem dependências)
docs/MONITORAMENTO.md               # este documento
```

## 4. Configuração

### 4.1 Pré-requisitos

- **Nenhum segredo a configurar.** O `GITHUB_TOKEN` é automático e o workflow
  declara apenas `permissions: contents: read` e `issues: write` (mínimo necessário).
- O repositório precisa ter **Issues habilitados** (já estão) e a label
  `monitoramento` é **criada automaticamente** na primeira execução.
- **Variáveis de ambiente usadas** (todas opcionais, com padrão seguro):

| Variável | Padrão | Uso |
|----------|--------|-----|
| `MONITOR_URL` | `https://conecta-senac-test.onrender.com/health` | endpoint alvo |
| `MONITOR_TIMEOUT_MS` | `120000` | timeout por tentativa (cold start do Render free medido: até ~65 s) |
| `MONITOR_ATTEMPTS` | `2` | tentativas por verificação |
| `MONITOR_GAP_MS` | `15000` | intervalo entre tentativas |
| `MONITOR_RESULT_FILE` | `<tmp>/conecta-health-result.json` | onde o resultado é gravado |

### 4.2 Ativação do agendamento (requer autorização)

O GitHub **só executa `schedule` na branch padrão** (`main-Versão-4.0`).
Portanto o monitor automático passa a rodar somente **após merge autorizado**
desta branch na principal — decisão e merge são do mantenedor do repositório.

Até lá, tudo pode ser testado manualmente (seção 5).

## 5. Como testar

### 5.1 Local — testes unitários

```bash
node --test scripts/monitor/check-health.test.mjs
# esperado: 20 pass, 0 fail
```

### 5.2 Local — verificação ao vivo

```bash
node scripts/monitor/check-health.mjs
# imprime o JSON do resultado; exit 0 = UP, exit 1 = falha
```

Com a API quente leva ~3 s; com o Render “dormindo” (cold start) pode levar
até ~120 s — por isso o timeout padrão é 120 s.

### 5.3 No GitHub (sem merge)

1. Abra **Actions → Monitor API Health → Run workflow** (disponível em qualquer branch).
2. Confira: job `teste` verde, job `monitorar` verde, resumo do job com a tabela
   (data, horário, duração, resultado) e artefato `health-result`.
3. Para simular falha sem tocar na API, rode localmente com variável de ambiente:
   `MONITOR_URL=https://httpstat.us/503 node scripts/monitor/check-health.mjs`
   (ou qualquer URL inválida para ver `UNAVAILABLE`/`TIMEOUT`).

### 5.4 Notificação ponta a ponta (opcional)

Para exercitar a matriz de Issues sem esperar uma falha real, execute o workflow
com `MONITOR_URL` apontando para uma URL quebrada e observe: issue criada →
novas execuções apenas editam a issue → corrigindo a URL, a próxima execução
comenta e fecha a issue.

## 6. Manutenção

| Tarefa | Como |
|--------|------|
| Mudar o intervalo | edite `cron` no workflow (mínimo prático: 5 min; `*/15` mantém o Render quente) |
| Mudar timeout/tentativas | `MONITOR_TIMEOUT_MS` / `MONITOR_ATTEMPTS` no workflow |
| Investigar uma falha | abra a execução vermelha → resumo do job + artefato `health-result` (30 dias) + logs (retenção do GitHub) |
| Revisar episódios | issues com label `monitoramento` (fechadas = episódios resolvidos) |
| Falsos alarmes por cold start | aumente `MONITOR_TIMEOUT_MS`; o retry (2 tentativas) já absorve transientes |
| GitHub desativa cron após ~60 dias sem atividade no repositório | qualquer push/issue/comentário reativa; verifique a aba Actions periodicamente |
| Notificações do GitHub sobre runs vermelhos | **Watch → Custom → Workflow runs** (as Issues do monitor são o canal principal) |

### Observações de operação

- **`schedule` só roda na branch padrão** após merge autorizado (seção 4.2).
- Execuções agendadas podem atrasar alguns minutos conforme a carga do GitHub.
- A cada 15 min a API recebe uma requisição: na prática isso **mantém o serviço
  do Render free acordado** (evita cold start de ~65 s para os usuários).
- A verificação é **somente leitura** (`GET /health`, endpoint público); não
  altera Supabase, Render, Vercel nem a lógica de negócio.

## 7. Segurança

- **Nenhum credencial, token ou variável de ambiente sensível** nos arquivos;
  `GITHUB_TOKEN` é gerado e revogado pelo GitHub, com permissões mínimas declaradas.
- O endpoint `/health` é público — **não há autenticação** no monitor.
- Nenhuma configuração de Supabase/Render/Vercel foi alterada.
- A senha de teste compartilhada em conversa **não está gravada em nenhum arquivo**
  deste repositório (não é necessária para o monitoramento).

## 8. Requisitos → onde estão atendidos

| # | Requisito | Onde |
|---|-----------|------|
| 1 | verificação periódica (HTTP 200) | `schedule: '*/15 * * * *'` + `check-health.mjs` |
| 2 | validar `"status":"UP"` | `classifyResponse()` — exigido além do 200 |
| 3 | indisponibilidade / timeout / resposta inesperada | `UNAVAILABLE` / `TIMEOUT` / `UNEXPECTED` |
| 4 | registrar data, horário, duração e resultado | JSON do resultado + tabela no job summary + artefato |
| 5 | notificar queda **e** recuperação | matriz de Issues (criar / comentar+fechar) |
| 6 | evitar notificações repetidas | 1 issue aberta por falha; edições são silenciosas |
| 7 | solução gratuita e justificada | GitHub Actions — seção 2 |
| 8 | documentar configuração, teste e manutenção | este documento |
