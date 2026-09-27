-- Fase 11, pedido do usuário: cada categoria guarda o próprio ícone (escolhido
-- numa lista fixa), em vez de o app deduzir pelo nome. As categorias padrão
-- recebem o ícone delas; as outras começam com a etiqueta ('tag').

alter table public.categories
  add column icon text not null default 'tag' check (icon ~ '^[a-z]{1,20}$');

update public.categories set icon = case translate(lower(trim(name)), 'áàâãéêíóôõúç', 'aaaaeeiooouc')
  when 'alimentacao' then 'food'
  when 'transporte' then 'car'
  when 'moradia' then 'home'
  when 'saude' then 'heart'
  when 'lazer' then 'star'
  when 'compras' then 'bag'
  when 'educacao' then 'book'
  when 'assinaturas' then 'repeat'
  when 'outros' then 'dots'
  else 'tag'
end;
