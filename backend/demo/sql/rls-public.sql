-- ============================================================================
-- RLS (Row Level Security) nas tabelas public
-- ============================================================================
-- Contexto: o Conecta-Senac fala com o Postgres SEMPRE pelo backend Spring
-- Boot (JDBC, role `postgres`), nunca pela API REST do Supabase. O frontend
-- usa `supabase-js`? Nao. Nenhum usuario anon/autenticated precisa de acesso
-- direto as tabelas.
--
-- Problema: com RLS desligado, o role `anon` (cuja chave publica e
-- relacionada no projeto) tinha DELETE/INSERT/UPDATE/TRUNCATE sobre as 15
-- tabelas de `public`. Bastava a chave publica para ler, alterar e apagar
-- tudo pela API `https://<ref>.supabase.co/rest/v1/...` -- inclusive a tabela
-- `usuarios`, que guarda as senhas.
--
-- Efeito: o Advisor do Supabase acusava "RLS Disabled in Public" (CRITICAL)
-- em uma tabela por vez (15 avisos).
--
-- Este script:
--   1. habilita RLS nas 15 tabelas  -> com RLS ligado e SEM politicas, o
--      Postgres nega tudo para quem nao e owner (default deny);
--   2. revoga os grants de `anon` e `authenticated` (defense in depth).
--
-- O app NAO e afetado: o backend conecta como `postgres`, que e owner das
-- tabelas e tem `rolbypassrls = t`, entao continua lendo e gravando igual.
--
-- Como executar (SQL Editor do Supabase ou psql):
--   SQL Editor do Supabase: cole o arquivo inteiro e rode.
--   psql: psql "$SUPABASE_DB_URL" -f backend/demo/sql/rls-public.sql
--
-- O script e idempotente: pode rodar quantas vezes quiser.
-- ============================================================================

DO $do$
DECLARE
    t text;
BEGIN
    FOR t IN
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = 'public'
          AND tablename <> '_migrations'
    LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
        EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);
        RAISE NOTICE 'RLS habilitado em public.%', t;
    END LOOP;
END
$do$;

-- Conferindo
SELECT c.relname AS tabela,
       c.relrowsecurity AS rls_habilitado,
       (SELECT count(*) FROM pg_policies p
         WHERE p.schemaname = 'public' AND p.tablename = c.relname) AS politicas
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r'
ORDER BY c.relname;
