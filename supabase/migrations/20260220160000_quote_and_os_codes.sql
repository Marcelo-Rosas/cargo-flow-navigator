-- =====================================================
-- Códigos sequenciais para Cotações e OS
-- quotes.quote_code  => COT-YYYY-MM-#### 
-- orders.os_number   => OS-YYYY-MM-#### (ajuste do formato atual)
-- =====================================================

-- 1) QUOTES: campo e gerador de código

ALTER TABLE public.quotes
ADD COLUMN IF NOT EXISTS quote_code TEXT;

CREATE OR REPLACE FUNCTION public.generate_quote_code()
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  year_part TEXT;
  month_part TEXT;
  next_seq INTEGER;
BEGIN
  year_part := TO_CHAR(NOW(), 'YYYY');
  month_part := TO_CHAR(NOW(), 'MM');

  SELECT COALESCE(
    MAX(CAST(SPLIT_PART(quote_code, '-', 4) AS INTEGER)),
    0
  ) + 1
  INTO next_seq
  FROM public.quotes
  WHERE SPLIT_PART(quote_code, '-', 1) = 'COT'
    AND SPLIT_PART(quote_code, '-', 2) = year_part
    AND SPLIT_PART(quote_code, '-', 3) = month_part;

  RETURN 'COT-' || year_part || '-' || month_part || '-' || LPAD(next_seq::TEXT, 4, '0');
END;
$$;

CREATE OR REPLACE FUNCTION public.set_quote_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.quote_code IS NULL OR NEW.quote_code = '' THEN
    NEW.quote_code := public.generate_quote_code();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_quote_code ON public.quotes;

CREATE TRIGGER set_quote_code
BEFORE INSERT ON public.quotes
FOR EACH ROW
EXECUTE FUNCTION public.set_quote_code();

-- 2) ORDERS: ajustar formato do os_number para OS-YYYY-MM-####

CREATE OR REPLACE FUNCTION public.generate_os_number()
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  year_part TEXT;
  month_part TEXT;
  next_seq INTEGER;
BEGIN
  year_part := TO_CHAR(NOW(), 'YYYY');
  month_part := TO_CHAR(NOW(), 'MM');

  SELECT COALESCE(
    MAX(CAST(SPLIT_PART(os_number, '-', 4) AS INTEGER)),
    0
  ) + 1
  INTO next_seq
  FROM public.orders
  WHERE SPLIT_PART(os_number, '-', 1) = 'OS'
    AND SPLIT_PART(os_number, '-', 2) = year_part
    AND SPLIT_PART(os_number, '-', 3) = month_part;

  RETURN 'OS-' || year_part || '-' || month_part || '-' || LPAD(next_seq::TEXT, 4, '0');
END;
$$;

CREATE OR REPLACE FUNCTION public.set_os_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.os_number IS NULL OR NEW.os_number = '' THEN
    NEW.os_number := public.generate_os_number();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_order_os_number ON public.orders;

CREATE TRIGGER set_order_os_number
BEFORE INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.set_os_number();

