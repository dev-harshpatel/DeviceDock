-- Cherry-picked from legacy 008 + 028.

do $$
begin
  if to_regclass('public.inventory') is null then
    raise notice 'Skipping 008_expand_inventory_grades: public.inventory table does not exist.';
    return;
  end if;

  alter table public.inventory
    drop constraint if exists inventory_grade_check;

  alter table public.inventory
    add constraint inventory_grade_check
    check (
      grade in (
        'A', 'B', 'C', 'D',
        'Brand New Sealed',
        'Brand New Open Box'
      )
    );

  comment on column public.inventory.grade is 'Product condition grade: Brand New Sealed, Brand New Open Box, A, B, C, D';
end $$;
