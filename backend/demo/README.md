# Conecta-Senac API

Backend MVC em Spring Boot para o sistema de reserva de salas do Conecta-Senac. A aplicacao usa Controllers, Services, Repositories JPA e entidades persistidas em banco relacional.

## Execucao

O projeto requer Java 17 ou superior. Nesta maquina, use o JDK 20 instalado:

```powershell
$env:JAVA_HOME='C:\Program Files\Java\jdk-20'
$env:Path="$env:JAVA_HOME\bin;$env:Path"
.\gradlew.bat bootRun
```

Por padrao, a API inicia em `http://localhost:8080` usando H2 em memoria. Para SQL Server, configure `DB_URL`, `DB_USERNAME`, `DB_PASSWORD` e `DB_DRIVER=com.microsoft.sqlserver.jdbc.SQLServerDriver`.

## Endpoints

| Recurso | Rotas |
| --- | --- |
| Autenticacao | `POST /api/login` |
| Dados de sincronizacao | `GET /api/dados` |
| Usuarios e unidades | CRUD em `/api/usuarios` e `/api/unidades` |
| Salas e turmas | CRUD em `/api/salas` e `/api/turmas` |
| Reservas | `GET/POST /api/reservas`, `PUT /api/reservas/{id}`, `DELETE /api/reservas/{id}` |
| Solicitacoes | `GET/POST /api/solicitacoes`, `POST /api/solicitacoes/{id}/resposta` |
| Chaves | `GET/POST /api/chaves`, `POST /api/chaves/{id}/retirada`, `POST /api/chaves/{id}/devolucao` |
| Notificacoes | `GET /api/notificacoes`, `POST /api/notificacoes/{id}/lida` |

Para aprovar uma solicitacao, envie `{ "decisao": "aprovar", "resposta": "..." }` para a rota de resposta. A API cria a reserva e notifica o instrutor na mesma transacao. Conflitos de sala, periodo, turno e dia da semana retornam `409`.

Credencial inicial: `senac_gdf@hotmail.com` / `Senac.DF2007`.
