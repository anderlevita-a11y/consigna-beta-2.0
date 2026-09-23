-- Consigna Beauty — função usada pelo script de migração de imagens.
-- Substitui uma referência de arquivo (trecho da URL pública) por outra em TODAS
-- as colunas que guardam URLs do Storage: text, text[] e jsonb.
--
-- Mapeamento levantado no banco em 23/09/2026. Se criar novas colunas de imagem,
-- basta incluí-las no array v_targets abaixo.
--
-- Segurança: SECURITY DEFINER, executável SOMENTE pelo service_role.

create or replace function public.image_migration_replace_ref(p_old text, p_new text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  -- formato: 'tabela.coluna:tipo'   (tipo = text | array | jsonb)
  v_targets text[] := array[
    'products.photo_url:text',
    'products.image_url:text',
    'products.image_urls:array',
    'central_products.photo_url:text',
    'central_products.image_urls:array',
    'store_settings.logo_url:text',
    'store_settings.banner_url:text',
    'store_settings.instagram_feed:jsonb',
    'product_reviews.customer_photo_url:text',
    'customers.document_photo_url:text',
    'customers.documento_url:text',
    'customers.residence_proof_url:text',
    'customers.comprovante_url:text',
    'profiles.documento_url:text',
    'profiles.comprovante_url:text',
    'payments.comprovante_url:text',
    'payment_receipts.receipt_url:text',
    'receipts.url:text',
    'mystery_bags.receipt_url:text',
    'raffle_tickets.receipt_url:text',
    'sweepstakes_participants.receipt_url:text'
  ];
  v_t text; v_tbl text; v_col text; v_kind text;
  v_rows int;
  v_result jsonb := '{}'::jsonb;
begin
  -- Proteções: exige trecho ancorado no caminho público do Storage.
  if p_old is null or p_new is null
     or p_old not like '/object/public/%' or p_new not like '/object/public/%'
     or p_old = p_new then
    raise exception 'image_migration_replace_ref: parâmetros inválidos (%, %)', p_old, p_new;
  end if;

  foreach v_t in array v_targets loop
    v_tbl  := split_part(split_part(v_t, ':', 1), '.', 1);
    v_col  := split_part(split_part(v_t, ':', 1), '.', 2);
    v_kind := split_part(v_t, ':', 2);

    -- ignora colunas que não existem mais
    continue when not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = v_tbl and column_name = v_col);

    if v_kind = 'text' then
      execute format(
        'update public.%I set %I = replace(%I, $1, $2) where strpos(%I, $1) > 0',
        v_tbl, v_col, v_col, v_col) using p_old, p_new;
    elsif v_kind = 'array' then
      execute format(
        'update public.%I set %I = array(select replace(x, $1, $2) from unnest(%I) with ordinality u(x, i) order by i)
          where strpos(array_to_string(%I, chr(31)), $1) > 0',
        v_tbl, v_col, v_col, v_col) using p_old, p_new;
    elsif v_kind = 'jsonb' then
      execute format(
        'update public.%I set %I = replace(%I::text, $1, $2)::jsonb where strpos(%I::text, $1) > 0',
        v_tbl, v_col, v_col, v_col) using p_old, p_new;
    end if;

    get diagnostics v_rows = row_count;
    if v_rows > 0 then
      v_result := v_result || jsonb_build_object(v_tbl || '.' || v_col, v_rows);
    end if;
  end loop;

  return v_result;
end;
$$;

revoke all on function public.image_migration_replace_ref(text, text) from public, anon, authenticated;
grant execute on function public.image_migration_replace_ref(text, text) to service_role;

-- Após concluir a migração, pode remover:
-- drop function public.image_migration_replace_ref(text, text);
