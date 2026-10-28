-- Run as the migration owner after migrations. The runtime login must be a
-- non-owner member of this NOLOGIN role and must not hold elevated privileges.
DO $$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='aicompany_app') THEN CREATE ROLE aicompany_app NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION; END IF; IF EXISTS (SELECT FROM pg_roles WHERE rolname='aicompany_app' AND (rolcanlogin OR rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls)) OR EXISTS (SELECT FROM pg_auth_members m JOIN pg_roles r ON r.oid=m.member WHERE r.rolname='aicompany_app') THEN RAISE EXCEPTION 'aicompany_app must be an unprivileged NOLOGIN role with no parent roles'; END IF; END $$;
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO aicompany_app;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM aicompany_app;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC;
GRANT SELECT ON companies, agents, agent_capabilities, agent_reports, usage_records, task_executions, execution_checkpoints TO aicompany_app;
GRANT SELECT, INSERT, UPDATE ON projects, approval_requests TO aicompany_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON tasks, task_dependencies, sessions TO aicompany_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON login_rate_limits TO aicompany_app;
GRANT SELECT, INSERT ON audit_events TO aicompany_app;
GRANT SELECT, INSERT, UPDATE ON runtime_settings, runtime_budgets, simulation_runs TO aicompany_app;
GRANT SELECT, INSERT ON simulation_ledger TO aicompany_app;
GRANT SELECT, INSERT ON runtime_denials TO aicompany_app;
GRANT UPDATE (count, last_seen) ON runtime_denials TO aicompany_app;
