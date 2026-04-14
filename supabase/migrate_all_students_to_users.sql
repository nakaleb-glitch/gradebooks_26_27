-- Run this ONCE to create user accounts for ALL existing students
-- This will generate student_id@royal.edu.vn emails with per-user random passwords.

DO $$
DECLARE
    s RECORD;
    hashed_pw TEXT;
    user_id UUID;
BEGIN
    -- Enable pgcrypto if not already enabled
    CREATE EXTENSION IF NOT EXISTS pgcrypto;
    
    FOR s IN SELECT id, student_id, name_eng, level FROM public.students LOOP
        
        -- Skip if already has user account
        IF EXISTS (SELECT 1 FROM public.users WHERE student_id_ref = s.id) THEN
            CONTINUE;
        END IF;

        -- Generate unique user id
        user_id := gen_random_uuid();

        -- Generate a unique random password hash for this user.
        hashed_pw := crypt(gen_random_uuid()::text, gen_salt('bf'));

        -- Create auth user
        INSERT INTO auth.users (
            id,
            instance_id,
            aud,
            role,
            email,
            encrypted_password,
            email_confirmed_at,
            created_at,
            updated_at,
            raw_app_meta_data,
            raw_user_meta_data,
            is_super_admin,
            confirmation_sent_at
        ) VALUES (
            user_id,
            '00000000-0000-0000-0000-000000000000',
            'authenticated',
            'authenticated',
            lower(s.student_id) || '@royal.edu.vn',
            hashed_pw,
            NOW(),
            NOW(),
            NOW(),
            '{"provider":"email","providers":["email"]}',
            jsonb_build_object('full_name', s.name_eng, 'student_id', s.student_id),
            false,
            NOW()
        );

        -- Create user profile
        INSERT INTO public.users (
            id,
            email,
            full_name,
            staff_id,
            role,
            level,
            student_id_ref,
            must_change_password,
            created_at,
            updated_at
        ) VALUES (
            user_id,
            lower(s.student_id) || '@royal.edu.vn',
            s.name_eng,
            s.student_id,
            'student',
            s.level,
            s.id,
            true,
            NOW(),
            NOW()
        );

    END LOOP;
END $$;