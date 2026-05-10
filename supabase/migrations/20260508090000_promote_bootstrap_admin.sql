/*
  # Promote bootstrap admin account

  Keeps the initial admin account working when the Auth user was created
  after the earlier admin migration had already run.
*/

UPDATE user_profiles
SET is_admin = true
WHERE lower(email) = 'admin@admin.pt';
