-- Migration 006b: Wskaźniki projektu "Postaw na Siebie" (FEDS.07.05-IP.02-0172/24)
-- Uruchom PO migration_006_indicators.sql
-- Wklej w Supabase SQL Editor i uruchom
-- Zastąp '27721fc6-935a-46a3-863b-b485bc0db01c' rzeczywistym UUID projektu PnS

-- Najpierw sprawdź UUID projektu PnS:
-- SELECT id, name, project_number FROM projects WHERE project_number ILIKE '%0172%';

-- WSKAŹNIKI PRODUKTU (product)
INSERT INTO project_indicators (project_id, code, name, type, target_value, unit, auto_field, notes, sort_order) VALUES

-- P.1 Bezrobotni
('27721fc6-935a-46a3-863b-b485bc0db01c', 'P.1',
 'Liczba osób bezrobotnych, w tym długotrwale bezrobotnych, objętych wsparciem w programie',
 'product', 40, 'os.', 'participants_unemployed',
 'K: 24, M: 16. Mierzony w momencie przystąpienia do 1. formy wsparcia.',
 10),

-- P.2 Bierni zawodowo
('27721fc6-935a-46a3-863b-b485bc0db01c', 'P.2',
 'Liczba osób biernych zawodowo objętych wsparciem w programie',
 'product', 40, 'os.', 'participants_inactive',
 'K: 24, M: 16.',
 20),

-- P.4 Długotrwale bezrobotni
('27721fc6-935a-46a3-863b-b485bc0db01c', 'P.4',
 'Liczba osób długotrwale bezrobotnych objętych wsparciem w programie',
 'product', 8, 'os.', 'participants_long_term_unemployed',
 'K: 5, M: 3.',
 30),

-- P.5 Wiek 18-29 lat
('27721fc6-935a-46a3-863b-b485bc0db01c', 'P.5',
 'Liczba osób w wieku 18–29 lat objętych wsparciem w programie',
 'product', 80, 'os.', 'participants_age_18_29',
 'K: 48, M: 32.',
 40),

-- P.9 Obszary wiejskie / marginalizowane
('27721fc6-935a-46a3-863b-b485bc0db01c', 'P.9',
 'Liczba osób z obszarów wiejskich/zagrożonych marginalizacją objętych wsparciem',
 'product', 48, 'os.', 'participants_rural',
 'K: 29, M: 19. DEGURBA lub obszary marginalizowane woj. dolnośląskiego.',
 50),

-- W.1 (wspólny) Niepełnosprawni
('27721fc6-935a-46a3-863b-b485bc0db01c', 'W.1',
 'Liczba osób z niepełnosprawnościami objętych wsparciem w programie',
 'product', 8, 'os.', 'participants_disabled',
 'K: 5, M: 3.',
 60);

-- WSKAŹNIKI REZULTATU (result)
INSERT INTO project_indicators (project_id, code, name, type, target_value, unit, auto_field, notes, sort_order) VALUES

-- R.1 Kwalifikacje
('27721fc6-935a-46a3-863b-b485bc0db01c', 'R.1',
 'Liczba osób, które uzyskały kwalifikacje po opuszczeniu programu',
 'result', 56, 'os.', null,
 'K: 30, M: 26. Mierzony do 4 tygodni po zakończeniu udziału UP w projekcie.',
 110),

-- R.2 Poprawa sytuacji społecznej
('27721fc6-935a-46a3-863b-b485bc0db01c', 'R.2',
 'Liczba osób, których sytuacja społeczna uległa poprawie po opuszczeniu programu',
 'result', 56, 'os.', null,
 'K: 30, M: 26.',
 120),

-- R.3 Zatrudnienie (umowa ≥½ etatu, ≥6 m-cy) [KRYTERIUM PREMIUJĄCE]
('27721fc6-935a-46a3-863b-b485bc0db01c', 'R.3',
 'Liczba osób które podjęły zatrudnienie na podstawie umowy o pracę w wymiarze co najmniej ½ etatu zawartej na okres co najmniej 6 miesięcy',
 'result', 16, 'os.', null,
 'K: 10, M: 6. Kryterium premiujące – min. 20% UP.',
 130),

-- R.4 Poszukujący pracy po programie
('27721fc6-935a-46a3-863b-b485bc0db01c', 'R.4',
 'Liczba osób poszukujących pracy po opuszczeniu programu',
 'result', 22, 'os.', null,
 'K: 13, M: 9. Dotyczy wyłącznie osób BZ w momencie wejścia do projektu.',
 140),

-- R.5 Pracujący po programie
('27721fc6-935a-46a3-863b-b485bc0db01c', 'R.5',
 'Liczba osób pracujących, łącznie z prowadzącymi działalność na własny rachunek, po opuszczeniu programu',
 'result', 24, 'os.', null,
 'K: 14, M: 10.',
 150);
