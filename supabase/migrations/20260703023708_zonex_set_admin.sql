-- Make sourav825093@gmail.com a super admin
INSERT INTO admin_roles (user_id, role)
VALUES ('d314772e-6a1e-4207-9ac1-3f5d841a6194', 'super_admin')
ON CONFLICT (user_id) DO UPDATE SET role = 'super_admin';

-- Verify the admin role was set
SELECT * FROM admin_roles WHERE user_id = 'd314772e-6a1e-4207-9ac1-3f5d841a6194';