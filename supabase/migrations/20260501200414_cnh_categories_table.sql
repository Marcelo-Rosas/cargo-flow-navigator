CREATE TABLE IF NOT EXISTS public.cnh_categories (
  id          serial PRIMARY KEY,
  code        text NOT NULL UNIQUE,
  description text NOT NULL,
  active      boolean NOT NULL DEFAULT true
);

INSERT INTO public.cnh_categories (code, description) VALUES
  ('A',  'Motocicletas, motonetas, ciclomotores e similares'),
  ('B',  'Automóveis, camionetes e utilitários de até 3.500 kg'),
  ('AB', 'Combinação das categorias A e B'),
  ('C',  'Veículos de carga com PBT acima de 3.500 kg'),
  ('D',  'Veículos de passageiros com mais de 8 lugares'),
  ('E',  'Veículos com combinação de unidades (carreta/bitrem)')
ON CONFLICT (code) DO NOTHING;
