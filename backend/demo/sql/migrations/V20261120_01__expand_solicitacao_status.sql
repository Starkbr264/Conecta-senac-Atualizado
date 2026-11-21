-- Migration manual versionada.
-- Aplicar somente em ambiente autorizado após validar o banco alvo.
-- Não converte, remove ou atualiza registros existentes.

BEGIN;

DO $$
DECLARE
    valores_desconhecidos TEXT;
BEGIN
    SELECT string_agg(status, ', ' ORDER BY status)
      INTO valores_desconhecidos
      FROM (
          SELECT DISTINCT status
            FROM public.solicitacoes
           WHERE status IS NOT NULL
             AND status NOT IN ('PENDENTE', 'APROVADA', 'RECUSADA', 'CANCELADA', 'EXPIRADA')
      ) AS valores;

    IF valores_desconhecidos IS NOT NULL THEN
        RAISE EXCEPTION
            'valores de status desconhecidos em solicitacoes: %',
            valores_desconhecidos;
    END IF;
END
$$;

ALTER TABLE public.solicitacoes
    DROP CONSTRAINT IF EXISTS solicitacoes_status_check;

ALTER TABLE public.solicitacoes
    ADD CONSTRAINT solicitacoes_status_check
    CHECK (status IN ('PENDENTE', 'APROVADA', 'RECUSADA', 'CANCELADA', 'EXPIRADA'));

COMMIT;
