-- Add carreteiro costs to orders
alter table public.orders
  add column if not exists carreteiro_antt numeric,
  add column if not exists carreteiro_real numeric;

-- Enforce: cannot move from busca_motorista -> documentacao without carreteiro_real
create or replace function public.enforce_carreteiro_real_before_documentacao()
returns trigger
language plpgsql
as $$
begin
  if (old.stage = 'busca_motorista' and new.stage = 'documentacao') then
    if new.carreteiro_real is null or new.carreteiro_real <= 0 then
      raise exception 'Não é possível avançar para Documentação sem informar o carreteiro real.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_carreteiro_real_before_documentacao on public.orders;

create trigger trg_enforce_carreteiro_real_before_documentacao
before update of stage on public.orders
for each row
execute function public.enforce_carreteiro_real_before_documentacao();
