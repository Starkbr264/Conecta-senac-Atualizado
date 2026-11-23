package conecta.demo;

import static org.junit.jupiter.api.Assertions.assertEquals;

import conecta.demo.repository.SincOperacaoRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@ActiveProfiles("test")
class SincOperacaoRepositoryTest {

    @Autowired
    private SincOperacaoRepository operacoes;

    @AfterEach
    void limpar() {
        operacoes.deleteAll();
    }

    @Test
    @Transactional
    void reservaOperacaoEGlobalmenteUnica() {
        assertEquals(1, operacoes.reservar("op-global", 42L, "{}"));
        assertEquals(0, operacoes.reservar("op-global", 99L, "{}"));
        assertEquals(42L, operacoes.findById("op-global").orElseThrow().getUsuarioId());
    }
}
