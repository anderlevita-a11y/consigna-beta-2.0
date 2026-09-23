# Migração de imagens (Supabase Storage → WebP)

Script independente (não faz parte do build do app) que otimiza as imagens **já existentes** no Storage.
Os novos uploads já são otimizados no navegador por `src/lib/uploadOptimizedImage.ts`.

Levantamento em 23/09/2026: bucket `products` com 213 arquivos / 409 MB; 108 referenciados no banco (236 MB), com PNGs de até 8,6 MB.


```bash
cd scripts/image-migration
npm install
cp .env.example .env          # preencha a SERVICE_ROLE_KEY
```

1. **Crie a função SQL.** Rode `supabase/migrations/20260923_image_migration_replace_ref.sql` no SQL Editor do Supabase. Só o `service_role` consegue executá-la.
2. **Simule.** `npm run dry-run` baixa e comprime tudo em memória e mostra a economia estimada, sem alterar nada.
3. **Teste com 5 arquivos.** `npm run test-5`. Depois confira no app se as fotos aparecem.
4. **Rode a migração completa.** `npm run migrate`
5. **(Opcional) Apague os originais.** Rode `node --env-file=.env optimize-images.mjs --apply --delete-originals`. Faça isso só depois de validar o app.

### Proteções

- **Dry-run por padrão.** Nada muda sem `--apply`.
- **Backup local.** Cada original é salvo em `./backups/<bucket>/<caminho>` antes de qualquer alteração.
- **Ordem segura.** O script envia o `.webp` e depois atualiza o banco. Se o banco falhar, o `.webp` é removido (rollback) e o original continua intacto. O original só é apagado se o banco foi atualizado e `--delete-originals` foi usado.
- **Sem troca inútil.** A imagem é ignorada se a economia for menor que 10% (`--min-saving`), se for animada ou se o nome colidir (ex.: `x.jpg` e `x.png` virariam `x.webp`).
- **Memória controlada.** O processamento é feito em lotes (`--batch=10`), com paralelismo limitado (`--concurrency=3`) e pausa entre lotes (`--delay=500`). O cache do sharp fica desligado.
- **Retry.** Download e upload são repetidos até 3 vezes, com backoff exponencial.
- **Log.** Cada arquivo gera uma linha em `./logs/migration-*.jsonl`.
- **Idempotente.** Pode rodar de novo após uma interrupção. Arquivos já convertidos são ignorados.

### Opções

| Flag | Padrão | |
|---|---|---|
| `--apply` | desligado | executa de verdade |
| `--buckets=products,documents` | `products` | buckets a processar |
| `--limit=N` | todos | processa só N arquivos |
| `--batch=N` / `--concurrency=N` / `--delay=ms` | 10 / 3 / 500 | controle de taxa e memória |
| `--max-long=1920 --max-short=1080` | 1920 / 1080 | caixa máxima |
| `--quality=80` | 80 | qualidade WebP |
| `--delete-originals` | desligado | apaga o original após sucesso |
| `--no-backup` | desligado | desliga o backup local |

### Observações

- **`documents` fica fora por padrão.** São fotos de documentos e comprovantes de clientes. Comprimir pode prejudicar a leitura e a validade como prova. Se quiser incluir, use `--buckets=products,documents` e teste antes com `--limit`.
- **Arquivos órfãos.** Cerca de 105 arquivos do bucket `products` (~173 MB) não são referenciados por nenhuma tabela. O script só trata arquivos referenciados. A limpeza dos órfãos é uma etapa separada, a ser revisada à parte.
- **Proporção 4:3.** Uma foto 4:3 em paisagem fica com 1440×1080, porque a altura limita. Se quiser manter 1920 de largura, use `--max-short=1440`.
- **Limpeza.** Ao terminar a migração, remova a função com `drop function public.image_migration_replace_ref(text, text);`.
