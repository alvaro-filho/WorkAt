-- Fatia 1 (25/11/2026): tipos de projeto, membros e convites.
-- Banco: arthub_dev (o que está em application.properties). Não precisa rodar no workat_db antigo.
--
-- O Hibernate (ddl-auto=update) cria sozinho, ao reiniciar o backend:
--   * a coluna project.type (projetos antigos ficam PERSONAL pelo default);
--   * as tabelas project_member e project_invitation.
-- O que ele NÃO faz é apagar a coluna antiga project.category, que é NOT NULL
-- e faria a criação de projetos falhar. Por isso este script.
--
-- Como rodar: pgAdmin > arthub_dev > Query Tool > colar e executar (F5).
-- Pode rodar antes ou depois de reiniciar o backend. É seguro rodar mais de uma vez.

ALTER TABLE project DROP COLUMN IF EXISTS category;
