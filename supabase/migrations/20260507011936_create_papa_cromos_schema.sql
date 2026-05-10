/*
  # Papa Cromos - Database Schema

  1. New Tables
    - `collections`
      - `id` (uuid, primary key) - Unique collection identifier
      - `name` (text) - Collection name (e.g., "Futebol 2024")
      - `description` (text) - Collection description
      - `image_url` (text) - Cover image URL
      - `total_stickers` (int) - Total number of stickers in collection
      - `created_at` (timestamptz) - Creation timestamp

    - `stickers`
      - `id` (uuid, primary key) - Unique sticker identifier
      - `collection_id` (uuid, FK) - Reference to parent collection
      - `number` (int) - Sticker number within collection
      - `name` (text) - Sticker name
      - `image_url` (text) - Sticker image URL
      - `rarity` (text) - Rarity level: common, uncommon, rare, legendary
      - `created_at` (timestamptz) - Creation timestamp

    - `user_stickers`
      - `id` (uuid, primary key) - Unique entry identifier
      - `user_id` (uuid, FK to auth.users) - Owner of the sticker
      - `sticker_id` (uuid, FK) - Reference to sticker
      - `status` (text) - "have" (available for trade) or "want" (looking for)
      - `quantity` (int) - Number of copies owned
      - `created_at` (timestamptz) - When added to collection

    - `trade_offers`
      - `id` (uuid, primary key) - Unique trade identifier
      - `from_user_id` (uuid, FK to auth.users) - User proposing trade
      - `to_user_id` (uuid, FK to auth.users) - User receiving trade offer
      - `offered_sticker_id` (uuid, FK) - Sticker being offered
      - `requested_sticker_id` (uuid, FK) - Sticker being requested
      - `status` (text) - Trade status: pending, accepted, rejected, completed
      - `created_at` (timestamptz) - When trade was proposed
      - `updated_at` (timestamptz) - Last status update

  2. Security
    - Enable RLS on all tables
    - Collections and stickers are readable by all authenticated users
    - User stickers are readable by authenticated users, writable only by owner
    - Trade offers are readable by involved parties, creatable by authenticated users

  3. Indexes
    - Index on user_stickers(user_id) for fast user collection queries
    - Index on user_stickers(sticker_id) for match lookups
    - Index on user_stickers(status) for filtering have/want
    - Index on trade_offers(from_user_id) and trade_offers(to_user_id)
*/

-- Collections
CREATE TABLE IF NOT EXISTS collections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text DEFAULT '',
  image_url text DEFAULT '',
  total_stickers int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE collections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view collections"
  ON collections FOR SELECT
  TO authenticated
  USING (true);

-- Stickers
CREATE TABLE IF NOT EXISTS stickers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id uuid NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  number int NOT NULL DEFAULT 0,
  name text NOT NULL,
  image_url text DEFAULT '',
  rarity text NOT NULL DEFAULT 'common' CHECK (rarity IN ('common', 'uncommon', 'rare', 'legendary')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE stickers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view stickers"
  ON stickers FOR SELECT
  TO authenticated
  USING (true);

-- User Stickers
CREATE TABLE IF NOT EXISTS user_stickers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sticker_id uuid NOT NULL REFERENCES stickers(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'have' CHECK (status IN ('have', 'want')),
  quantity int NOT NULL DEFAULT 1,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, sticker_id, status)
);

ALTER TABLE user_stickers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own stickers"
  ON user_stickers FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view other users stickers for matching"
  ON user_stickers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert own stickers"
  ON user_stickers FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own stickers"
  ON user_stickers FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own stickers"
  ON user_stickers FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Trade Offers
CREATE TABLE IF NOT EXISTS trade_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  to_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  offered_sticker_id uuid NOT NULL REFERENCES stickers(id) ON DELETE CASCADE,
  requested_sticker_id uuid NOT NULL REFERENCES stickers(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'completed')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE trade_offers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view trades involving them"
  ON trade_offers FOR SELECT
  TO authenticated
  USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);

CREATE POLICY "Users can create trade offers"
  ON trade_offers FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = from_user_id);

CREATE POLICY "Users can update trades involving them"
  ON trade_offers FOR UPDATE
  TO authenticated
  USING (auth.uid() = from_user_id OR auth.uid() = to_user_id)
  WITH CHECK (auth.uid() = from_user_id OR auth.uid() = to_user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_stickers_user_id ON user_stickers(user_id);
CREATE INDEX IF NOT EXISTS idx_user_stickers_sticker_id ON user_stickers(sticker_id);
CREATE INDEX IF NOT EXISTS idx_user_stickers_status ON user_stickers(status);
CREATE INDEX IF NOT EXISTS idx_trade_offers_from_user ON trade_offers(from_user_id);
CREATE INDEX IF NOT EXISTS idx_trade_offers_to_user ON trade_offers(to_user_id);
