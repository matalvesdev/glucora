# ADR-066: SAST gratuito para o repositório público

Status: ACCEPTED

## Contexto

H6 exige varreduras de segurança proporcionais ao MVP. O CI já verifica
segredos com Gitleaks e padrões locais e bloqueia dependências com
vulnerabilidades de severidade alta. Ainda falta uma análise estática dedicada
ao código TypeScript e JavaScript.

## Decisão

Usar GitHub CodeQL no repositório público para analisar JavaScript e TypeScript
em cada push para `main`, pull request direcionado a `main` e semanalmente. O
workflow usa a suíte `security-extended`, tempo máximo de quinze minutos,
concorrência cancelável e somente permissões de leitura do conteúdo e escrita
dos resultados de segurança.

As ações são fixadas por commit. O workflow não recebe secrets, não executa
contra dados de saúde e não substitui revisão humana, testes de autorização,
DAST quando houver ambiente implantado ou o processo de resposta a
vulnerabilidades. A escolha vale para o repositório público e para H6 do MVP;
não define fornecedor de segurança ou SIEM de produção.

Aceita por Mateus Alves Bassane em 2026-09-28, evidência `00001`.
