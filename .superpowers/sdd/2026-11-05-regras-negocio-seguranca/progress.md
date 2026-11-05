# SDD ledger — plan: docs/superpowers/plans/2026-11-05-regras-negocio-seguranca.md

Backup criado antes das alterações: `C:\Users\enzol\AppData\Local\Temp\opencode\Conecta-senac-Atualizado-backup-20261105-181401.zip`.

Ruling: priorizar regras críticas de servidor e sincronização — são o caminho efetivo usado pela aplicação; UI isolada não protege dados.

Task 1: complete — regras críticas aplicadas; `./gradlew.bat test` → BUILD SUCCESSFUL (67 testes); `npm run build` → sucesso; `git diff --check` → sem saída.

Backup pós-implementação: `C:\Users\enzol\AppData\Local\Temp\opencode\Conecta-senac-Atualizado-implementado-20261105-183030.zip`.

Ruling: não alterar dados remotos — a correção do CEP inválido e a limpeza de contas de teste ficam para operação controlada posterior, pois o pedido autorizou código local, não mutação de produção.
