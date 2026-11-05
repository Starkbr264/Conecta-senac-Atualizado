# Regras de negócio e segurança — Plano de implementação

> Execução local autorizada pelo solicitante; não publicar nem fazer push.

**Objetivo:** aplicar no backend as regras críticas de autorização, unidade, salas, turmas, reservas, solicitações e chaves identificadas na auditoria.

**Abordagem:** manter os endpoints existentes, reforçando controllers/services e o caminho real de sincronização `/api/sinc`. O frontend receberá apenas validações de UX; a fonte de verdade será sempre o JWT e o backend.

**Restrições:** backup ZIP fora do repositório antes das alterações; nenhuma alteração no GitHub; nenhum deploy; dados de produção não serão editados por este trabalho.

## Escopo

1. Restringir escrita por perfil nos controllers.
2. Validar turno/sala/turma/período/conflito no serviço de reservas.
3. Validar instrutor da mesma unidade e cascata turma→reservas.
4. Impedir exclusão de sala com reservas e exigir turno.
5. Impedir respostas de solicitação por não coordenadores e validar autoria/unidade.
6. Restringir chaves à recepção/admin e validar unidade/perfil.
7. Aplicar as mesmas regras no `/api/sinc`, que é o caminho usado pelo web/mobile.
8. Adicionar validações de senha e nome/CEP de unidade sem alterar dados existentes.

## Evidência

- `gradlew test` para regressões do backend.
- `npm run build` para o frontend.
- Testes unitários novos para reservas, turmas, salas e sincronização.
- `git diff --check` e `git status` para confirmar escopo local.

## Fora do escopo

- Deploy, push, merge ou publicação.
- Limpeza/correção de dados no banco remoto.
- Migração destrutiva de schema; histórico de chave será compatível com migração posterior.
