/*
  # Promote initial admin user

  This expects the Auth user `admin@admin.pt` to already exist.
*/

INSERT INTO user_profiles (id, username, email, phone, city, avatar_seed, is_admin)
SELECT
  auth.users.id,
  'admin',
  auth.users.email,
  '',
  '',
  'admin',
  true
FROM auth.users
WHERE auth.users.email = 'admin@admin.pt'
ON CONFLICT (id) DO UPDATE SET
  username = excluded.username,
  email = excluded.email,
  phone = excluded.phone,
  city = excluded.city,
  avatar_seed = excluded.avatar_seed,
  is_admin = true;

