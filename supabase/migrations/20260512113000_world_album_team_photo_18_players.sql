-- Rebuild the independent world album as 48 pages with 1 crest, 18 players and 1 team photo each.
-- This replaces the previous 6-sticker-per-team seed for this collection.

DELETE FROM stickers
WHERE collection_id = 'b2026000-0000-4000-8000-000000000001';

INSERT INTO collections (id, name, description, image_url, total_stickers)
VALUES (
  'b2026000-0000-4000-8000-000000000001',
  'Caderneta Mundial 2026',
  'Uma caderneta comunitaria independente inspirada no grande torneio mundial de futebol. Cada selecao tem escudo, foto de equipa e 18 jogadores.',
  '/logo.png',
  960
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  image_url = EXCLUDED.image_url,
  total_stickers = EXCLUDED.total_stickers;

WITH teams(team_order, team_name) AS (
  VALUES
    (1, 'México'),
    (2, 'África do Sul'),
    (3, 'República da Coreia'),
    (4, 'Tchéquia'),
    (5, 'Canadá'),
    (6, 'Bósnia e Herzegovina'),
    (7, 'Catar'),
    (8, 'Suíça'),
    (9, 'Brasil'),
    (10, 'Marrocos'),
    (11, 'Haiti'),
    (12, 'Escócia'),
    (13, 'Estados Unidos'),
    (14, 'Austrália'),
    (15, 'Paraguai'),
    (16, 'Turquia'),
    (17, 'Alemanha'),
    (18, 'Curaçau'),
    (19, 'Costa do Marfim'),
    (20, 'Equador'),
    (21, 'Holanda'),
    (22, 'Japão'),
    (23, 'Suécia'),
    (24, 'Tunísia'),
    (25, 'Bélgica'),
    (26, 'Egito'),
    (27, 'RI do Irã'),
    (28, 'Nova Zelândia'),
    (29, 'Espanha'),
    (30, 'Cabo Verde'),
    (31, 'Arábia Saudita'),
    (32, 'Uruguai'),
    (33, 'França'),
    (34, 'Iraque'),
    (35, 'Noruega'),
    (36, 'Senegal'),
    (37, 'Argentina'),
    (38, 'Argélia'),
    (39, 'Áustria'),
    (40, 'Jordânia'),
    (41, 'Portugal'),
    (42, 'Jamaica'),
    (43, 'Uzbequistão'),
    (44, 'Colômbia'),
    (45, 'Inglaterra'),
    (46, 'Croácia'),
    (47, 'Gana'),
    (48, 'Panamá')
),
slots(slot_order, slot_name, rarity) AS (
  SELECT
    slot_order,
    CASE
      WHEN slot_order = 1 THEN 'Escudo'
      WHEN slot_order = 13 THEN 'Foto de equipa'
      WHEN slot_order < 13 THEN 'Jogador ' || lpad((slot_order - 1)::text, 2, '0')
      ELSE 'Jogador ' || lpad((slot_order - 2)::text, 2, '0')
    END AS slot_name,
    CASE
      WHEN slot_order IN (1, 13) THEN 'rare'
      WHEN slot_order IN (7, 19, 20) THEN 'uncommon'
      WHEN slot_order = 18 THEN 'legendary'
      ELSE 'common'
    END AS rarity
  FROM generate_series(1, 20) AS slot_order
),
album_stickers AS (
  SELECT
    'b2026000-0000-4000-8000-000000000001'::uuid AS collection_id,
    ((teams.team_order - 1) * 20 + slots.slot_order) AS number,
    teams.team_name || ' - ' || slots.slot_name AS name,
    CASE
      WHEN teams.team_name = 'Tchéquia' THEN
        CASE slots.slot_order
          WHEN 1 THEN '/stickers/tchequia/tchequia-01.png'
          WHEN 2 THEN '/stickers/tchequia/tchequia-02.png'
          WHEN 3 THEN '/stickers/tchequia/tchequia-03.png'
          WHEN 4 THEN '/stickers/tchequia/tchequia-04.png'
          WHEN 5 THEN '/stickers/tchequia/tchequia-06.png'
          WHEN 6 THEN '/stickers/tchequia/tchequia-07.png'
          WHEN 7 THEN '/stickers/tchequia/tchequia-08.png'
          WHEN 8 THEN '/stickers/tchequia/tchequia-09.png'
          WHEN 9 THEN '/stickers/tchequia/tchequia-10.png'
          WHEN 10 THEN '/stickers/tchequia/tchequia-11.png'
          WHEN 11 THEN '/stickers/tchequia/tchequia-12.png'
          WHEN 12 THEN '/stickers/tchequia/tchequia-13.png'
          WHEN 13 THEN '/stickers/tchequia/tchequia-05.png'
          WHEN 14 THEN '/stickers/tchequia/tchequia-14.png'
          WHEN 15 THEN '/stickers/tchequia/tchequia-15.png'
          WHEN 16 THEN '/stickers/tchequia/tchequia-16.png'
          WHEN 17 THEN '/stickers/tchequia/tchequia-17.png'
          WHEN 18 THEN '/stickers/tchequia/tchequia-18.png'
          WHEN 19 THEN '/stickers/tchequia/tchequia-19.png'
          WHEN 20 THEN '/stickers/tchequia/tchequia-20.png'
        END
      WHEN teams.team_name = 'República da Coreia' THEN
        CASE slots.slot_order
          WHEN 1 THEN '/stickers/republica-da-coreia/republica-da-coreia-01.png'
          WHEN 2 THEN '/stickers/republica-da-coreia/republica-da-coreia-02.png'
          WHEN 3 THEN '/stickers/republica-da-coreia/republica-da-coreia-03.png'
          WHEN 4 THEN '/stickers/republica-da-coreia/republica-da-coreia-04.png'
          WHEN 5 THEN '/stickers/republica-da-coreia/republica-da-coreia-06.png'
          WHEN 6 THEN '/stickers/republica-da-coreia/republica-da-coreia-07.png'
          WHEN 7 THEN '/stickers/republica-da-coreia/republica-da-coreia-08.png'
          WHEN 8 THEN '/stickers/republica-da-coreia/republica-da-coreia-09.png'
          WHEN 9 THEN '/stickers/republica-da-coreia/republica-da-coreia-10.png'
          WHEN 10 THEN '/stickers/republica-da-coreia/republica-da-coreia-11.png'
          WHEN 11 THEN '/stickers/republica-da-coreia/republica-da-coreia-12.png'
          WHEN 12 THEN '/stickers/republica-da-coreia/republica-da-coreia-13.png'
          WHEN 13 THEN '/stickers/republica-da-coreia/republica-da-coreia-05.png'
          WHEN 14 THEN '/stickers/republica-da-coreia/republica-da-coreia-14.png'
          WHEN 15 THEN '/stickers/republica-da-coreia/republica-da-coreia-15.png'
          WHEN 16 THEN '/stickers/republica-da-coreia/republica-da-coreia-16.png'
          WHEN 17 THEN '/stickers/republica-da-coreia/republica-da-coreia-17.png'
          WHEN 18 THEN '/stickers/republica-da-coreia/republica-da-coreia-18.png'
          WHEN 19 THEN '/stickers/republica-da-coreia/republica-da-coreia-19.png'
          WHEN 20 THEN '/stickers/republica-da-coreia/republica-da-coreia-20.png'
        END
      WHEN teams.team_name = 'África do Sul' THEN
        CASE slots.slot_order
          WHEN 1 THEN '/stickers/africa-do-sul/africa-do-sul-01.png'
          WHEN 2 THEN '/stickers/africa-do-sul/africa-do-sul-02.png'
          WHEN 3 THEN '/stickers/africa-do-sul/africa-do-sul-03.png'
          WHEN 4 THEN '/stickers/africa-do-sul/africa-do-sul-04.png'
          WHEN 5 THEN '/stickers/africa-do-sul/africa-do-sul-06.png'
          WHEN 6 THEN '/stickers/africa-do-sul/africa-do-sul-07.png'
          WHEN 7 THEN '/stickers/africa-do-sul/africa-do-sul-08.png'
          WHEN 8 THEN '/stickers/africa-do-sul/africa-do-sul-09.png'
          WHEN 9 THEN '/stickers/africa-do-sul/africa-do-sul-10.png'
          WHEN 10 THEN '/stickers/africa-do-sul/africa-do-sul-11.png'
          WHEN 11 THEN '/stickers/africa-do-sul/africa-do-sul-12.png'
          WHEN 12 THEN '/stickers/africa-do-sul/africa-do-sul-13.png'
          WHEN 13 THEN '/stickers/africa-do-sul/africa-do-sul-05.png'
          WHEN 14 THEN '/stickers/africa-do-sul/africa-do-sul-14.png'
          WHEN 15 THEN '/stickers/africa-do-sul/africa-do-sul-15.png'
          WHEN 16 THEN '/stickers/africa-do-sul/africa-do-sul-16.png'
          WHEN 17 THEN '/stickers/africa-do-sul/africa-do-sul-17.png'
          WHEN 18 THEN '/stickers/africa-do-sul/africa-do-sul-18.png'
          WHEN 19 THEN '/stickers/africa-do-sul/africa-do-sul-19.png'
          WHEN 20 THEN '/stickers/africa-do-sul/africa-do-sul-20.png'
        END
      WHEN teams.team_name = 'México' THEN
        CASE slots.slot_order
          WHEN 1 THEN '/stickers/mexico/mexico-01.png'
          WHEN 2 THEN '/stickers/mexico/mexico-02.png'
          WHEN 3 THEN '/stickers/mexico/mexico-03.png'
          WHEN 4 THEN '/stickers/mexico/mexico-04.png'
          WHEN 5 THEN '/stickers/mexico/mexico-06.png'
          WHEN 6 THEN '/stickers/mexico/mexico-07.png'
          WHEN 7 THEN '/stickers/mexico/mexico-08.png'
          WHEN 8 THEN '/stickers/mexico/mexico-09.png'
          WHEN 9 THEN '/stickers/mexico/mexico-10.png'
          WHEN 10 THEN '/stickers/mexico/mexico-11.png'
          WHEN 11 THEN '/stickers/mexico/mexico-12.png'
          WHEN 12 THEN '/stickers/mexico/mexico-13.png'
          WHEN 13 THEN '/stickers/mexico/mexico-05.png'
          WHEN 14 THEN '/stickers/mexico/mexico-14.png'
          WHEN 15 THEN '/stickers/mexico/mexico-15.png'
          WHEN 16 THEN '/stickers/mexico/mexico-16.png'
          WHEN 17 THEN '/stickers/mexico/mexico-17.png'
          WHEN 18 THEN '/stickers/mexico/mexico-18.png'
          WHEN 19 THEN '/stickers/mexico/mexico-19.png'
          WHEN 20 THEN '/stickers/mexico/mexico-20.png'
        END
      WHEN slots.slot_order = 1 THEN 'https://images.pexels.com/photos/399187/pexels-photo-399187.jpeg?auto=compress&cs=tinysrgb&w=400'
      WHEN slots.slot_order = 13 THEN 'https://images.pexels.com/photos/399187/pexels-photo-399187.jpeg?auto=compress&cs=tinysrgb&w=600'
      WHEN slots.slot_order = 18 THEN 'https://images.pexels.com/photos/114296/pexels-photo-114296.jpeg?auto=compress&cs=tinysrgb&w=400'
      ELSE 'https://images.pexels.com/photos/46798/the-ball-stadion-football-the-pitch.jpg?auto=compress&cs=tinysrgb&w=400'
    END AS image_url,
    slots.rarity
  FROM teams
  CROSS JOIN slots
)
INSERT INTO stickers (collection_id, number, name, image_url, rarity)
SELECT collection_id, number, name, image_url, rarity
FROM album_stickers;
