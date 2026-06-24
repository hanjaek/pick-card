-- ============================================================
-- 카드 색상 자연스럽게 업데이트 (데이터 유지, 색상만 변경)
-- 실행: mysql -u root -p1234 bnk_card < prototype\server\update_card_colors.sql
-- ============================================================
USE bnk_card;

UPDATE cards SET color_from = '#1B3A5C', color_to = '#2D6195' WHERE id = 1;  -- Young: 스틸블루
UPDATE cards SET color_from = '#1C1C2E', color_to = '#2D2D3E' WHERE id = 2;  -- 마이플러스: 다크챠콜
UPDATE cards SET color_from = '#7A1515', color_to = '#B82020' WHERE id = 3;  -- 부산사랑: 딥레드
UPDATE cards SET color_from = '#111111', color_to = '#222222' WHERE id = 4;  -- 하이라이프: 럭셔리블랙
UPDATE cards SET color_from = '#0F3D28', color_to = '#1B6340' WHERE id = 5;  -- 그린라이프: 포레스트그린
UPDATE cards SET color_from = '#280B42', color_to = '#4A1578' WHERE id = 6;  -- 쇼핑플러스: 딥바이올렛
UPDATE cards SET color_from = '#0A1628', color_to = '#122240' WHERE id = 7;  -- 트래블: 딥네이비
UPDATE cards SET color_from = '#5C3A1E', color_to = '#8A5C2E' WHERE id = 8;  -- 알뜰: 브론즈
