-- Update ALL RLS policies to include admin_teacher as valid admin role

-- Update all policies that check for role = 'admin'
DO $$
DECLARE
    policy_record RECORD;
    policy_name text;
    table_name text;
    table_schema text;
    new_policy_def text;
BEGIN
    -- Deprecated: this migration rewrites policies generically and can change semantics.
    -- Keep as historical artifact; use explicit table-scoped migrations instead.
    RAISE NOTICE 'Skipping deprecated migration 20260413142105_update_admin_rls_policies.sql';
    RETURN;

    -- Loop through all RLS policies that check for admin role
    FOR policy_record IN
        SELECT
            pol.polname AS policy_name,
            c.relname AS table_name,
            n.nspname AS table_schema,
            pg_get_expr(pol.polqual, pol.polrelid) AS policy_expression
        FROM pg_policy pol
        JOIN pg_class c ON pol.polrelid = c.oid
        JOIN pg_namespace n ON c.relnamespace = n.oid
        WHERE pg_get_expr(pol.polqual, pol.polrelid) LIKE '%role = ''admin''%'
    LOOP
        -- Replace role = 'admin' with role IN ('admin', 'admin_teacher')
        new_policy_def := REPLACE(
            REPLACE(policy_record.policy_expression, 'role = ''admin''', 'role IN (''admin'', ''admin_teacher'')'),
            '"role" = ''admin''', '"role" IN (''admin'', ''admin_teacher'')'
        );

        -- Drop existing policy
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I',
            policy_record.policy_name,
            policy_record.table_schema,
            policy_record.table_name
        );

        -- Recreate updated policy
        EXECUTE format('CREATE POLICY %I ON %I.%I FOR ALL USING (%s) WITH CHECK (%s)',
            policy_record.policy_name,
            policy_record.table_schema,
            policy_record.table_name,
            new_policy_def,
            new_policy_def
        );
    END LOOP;
END $$;