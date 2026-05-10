/*
  # Seed sample data

  1. Inserts
    - 1 collection: "Futebol Mundial 2026"
    - 24 stickers: football players with varying rarities
*/

INSERT INTO collections (id, name, description, image_url, total_stickers)
VALUES (
  'a1b2c3d4-0000-0000-0000-000000000001',
  'Futebol Mundial 2026',
  'A colecao oficial do Mundial 2026! Reune os melhores jogadores do planeta.',
  'https://images.pexels.com/photos/46798/the-ball-stadion-football-the-pitch.jpg?auto=compress&cs=tinysrgb&w=400',
  24
);

INSERT INTO stickers (collection_id, number, name, image_url, rarity) VALUES
('a1b2c3d4-0000-0000-0000-000000000001', 1, 'Cristiano Ronaldo', 'https://images.pexels.com/photos/46798/the-ball-stadion-football-the-pitch.jpg?auto=compress&cs=tinysrgb&w=200', 'legendary'),
('a1b2c3d4-0000-0000-0000-000000000001', 2, 'Lionel Messi', 'https://images.pexels.com/photos/274422/pexels-photo-274422.jpeg?auto=compress&cs=tinysrgb&w=200', 'legendary'),
('a1b2c3d4-0000-0000-0000-000000000001', 3, 'Kylian Mbappe', 'https://images.pexels.com/photos/47730/the-ball-stadion-football-the-pitch.jpg?auto=compress&cs=tinysrgb&w=200', 'rare'),
('a1b2c3d4-0000-0000-0000-000000000001', 4, 'Vinicius Jr', 'https://images.pexels.com/photos/114296/pexels-photo-114296.jpeg?auto=compress&cs=tinysrgb&w=200', 'rare'),
('a1b2c3d4-0000-0000-0000-000000000001', 5, 'Jude Bellingham', 'https://images.pexels.com/photos/1171084/pexels-photo-1171084.jpeg?auto=compress&cs=tinysrgb&w=200', 'rare'),
('a1b2c3d4-0000-0000-0000-000000000001', 6, 'Erling Haaland', 'https://images.pexels.com/photos/209845/pexels-photo-209845.jpeg?auto=compress&cs=tinysrgb&w=200', 'rare'),
('a1b2c3d4-0000-0000-0000-000000000001', 7, 'Pedri', 'https://images.pexels.com/photos/47730/the-ball-stadion-football-the-pitch.jpg?auto=compress&cs=tinysrgb&w=200', 'uncommon'),
('a1b2c3d4-0000-0000-0000-000000000001', 8, 'Florian Wirtz', 'https://images.pexels.com/photos/274422/pexels-photo-274422.jpeg?auto=compress&cs=tinysrgb&w=200', 'uncommon'),
('a1b2c3d4-0000-0000-0000-000000000001', 9, 'Bukayo Saka', 'https://images.pexels.com/photos/114296/pexels-photo-114296.jpeg?auto=compress&cs=tinysrgb&w=200', 'uncommon'),
('a1b2c3d4-0000-0000-0000-000000000001', 10, 'Lamine Yamal', 'https://images.pexels.com/photos/1171084/pexels-photo-1171084.jpeg?auto=compress&cs=tinysrgb&w=200', 'uncommon'),
('a1b2c3d4-0000-0000-0000-000000000001', 11, 'Phil Foden', 'https://images.pexels.com/photos/209845/pexels-photo-209845.jpeg?auto=compress&cs=tinysrgb&w=200', 'common'),
('a1b2c3d4-0000-0000-0000-000000000001', 12, 'Rodri', 'https://images.pexels.com/photos/46798/the-ball-stadion-football-the-pitch.jpg?auto=compress&cs=tinysrgb&w=200', 'common'),
('a1b2c3d4-0000-0000-0000-000000000001', 13, 'Bernardo Silva', 'https://images.pexels.com/photos/274422/pexels-photo-274422.jpeg?auto=compress&cs=tinysrgb&w=200', 'common'),
('a1b2c3d4-0000-0000-0000-000000000001', 14, 'Bruno Fernandes', 'https://images.pexels.com/photos/114296/pexels-photo-114296.jpeg?auto=compress&cs=tinysrgb&w=200', 'common'),
('a1b2c3d4-0000-0000-0000-000000000001', 15, 'Diogo Costa', 'https://images.pexels.com/photos/1171084/pexels-photo-1171084.jpeg?auto=compress&cs=tinysrgb&w=200', 'common'),
('a1b2c3d4-0000-0000-0000-000000000001', 16, 'Rafael Leao', 'https://images.pexels.com/photos/209845/pexels-photo-209845.jpeg?auto=compress&cs=tinysrgb&w=200', 'common'),
('a1b2c3d4-0000-0000-0000-000000000001', 17, 'Joao Felix', 'https://images.pexels.com/photos/47730/the-ball-stadion-football-the-pitch.jpg?auto=compress&cs=tinysrgb&w=200', 'common'),
('a1b2c3d4-0000-0000-0000-000000000001', 18, 'Ruben Dias', 'https://images.pexels.com/photos/274422/pexels-photo-274422.jpeg?auto=compress&cs=tinysrgb&w=200', 'common'),
('a1b2c3d4-0000-0000-0000-000000000001', 19, 'Pepe', 'https://images.pexels.com/photos/114296/pexels-photo-114296.jpeg?auto=compress&cs=tinysrgb&w=200', 'common'),
('a1b2c3d4-0000-0000-0000-000000000001', 20, 'Nuno Mendes', 'https://images.pexels.com/photos/1171084/pexels-photo-1171084.jpeg?auto=compress&cs=tinysrgb&w=200', 'common'),
('a1b2c3d4-0000-0000-0000-000000000001', 21, 'Vitinha', 'https://images.pexels.com/photos/209845/pexels-photo-209845.jpeg?auto=compress&cs=tinysrgb&w=200', 'common'),
('a1b2c3d4-0000-0000-0000-000000000001', 22, 'Ousmane Dembele', 'https://images.pexels.com/photos/46798/the-ball-stadion-football-the-pitch.jpg?auto=compress&cs=tinysrgb&w=200', 'uncommon'),
('a1b2c3d4-0000-0000-0000-000000000001', 23, 'Jamal Musiala', 'https://images.pexels.com/photos/274422/pexels-photo-274422.jpeg?auto=compress&cs=tinysrgb&w=200', 'uncommon'),
('a1b2c3d4-0000-0000-0000-000000000001', 24, 'Antoine Griezmann', 'https://images.pexels.com/photos/114296/pexels-photo-114296.jpeg?auto=compress&cs=tinysrgb&w=200', 'uncommon');
