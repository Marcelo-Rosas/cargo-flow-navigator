-- Previne faixas de KM sobrepostas na mesma price_table_id
-- Edições manuais ou inserções via UI poderiam criar overlaps; o importador já valida no batch
CREATE OR REPLACE FUNCTION public.price_table_rows_no_overlap()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.price_table_rows r
    WHERE r.price_table_id = NEW.price_table_id
      AND r.id IS DISTINCT FROM NEW.id
      AND r.km_from <= NEW.km_to
      AND r.km_to >= NEW.km_from
  ) THEN
    RAISE EXCEPTION 'Faixa sobreposta para esta tabela (%)', NEW.price_table_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_price_table_rows_no_overlap ON public.price_table_rows;
CREATE TRIGGER trg_price_table_rows_no_overlap
  BEFORE INSERT OR UPDATE ON public.price_table_rows
  FOR EACH ROW EXECUTE FUNCTION public.price_table_rows_no_overlap();
