-- A coluna permanece nullable para preservar registros criados antes do uid.
CREATE TABLE IF NOT EXISTS sinc_operacoes (
    id VARCHAR(120) NOT NULL,
    resposta_json TEXT NOT NULL,
    usuario_id BIGINT NULL,
    criada_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_sinc_operacoes PRIMARY KEY (id)
);

ALTER TABLE sinc_operacoes
    ADD COLUMN IF NOT EXISTS usuario_id BIGINT NULL;

CREATE INDEX IF NOT EXISTS ix_sinc_operacoes_usuario_id
    ON sinc_operacoes (usuario_id);

-- A FK e adicionada somente quando usuarios ja existe; NOT VALID preserva
-- qualquer dado historico sem proprietario ou usuario excluido.
DO $$
BEGIN
    IF to_regclass('public.usuarios') IS NOT NULL
       AND NOT EXISTS (
           SELECT 1 FROM pg_constraint
           WHERE conname = 'fk_sinc_operacoes_usuario'
       ) THEN
        ALTER TABLE sinc_operacoes
            ADD CONSTRAINT fk_sinc_operacoes_usuario
            FOREIGN KEY (usuario_id) REFERENCES usuarios(id) NOT VALID;
    END IF;
END $$;
