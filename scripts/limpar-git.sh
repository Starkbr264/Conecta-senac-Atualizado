#!/usr/bin/env bash
# =============================================================================
#  limpeza-git.sh - expurga blobs orfaos de node_modules/.idea/.vscode do
#                   historico do Conecta-Senac e reempacota o .git.
#
#  USO
#      bash scripts/limpar-git.sh --dry-run     # so mostra o plano, nao altera nada
#      bash scripts/limpar-git.sh --gc-only     # so o empacotamento (NAO apaga historico)
#      bash scripts/limpar-git.sh --rewrite     # expurga o historico (DESTRUTIVO)
#
#  POR QUE EXISTEM DOIS MODOS
#      `git gc --prune=now` so apaga objetos INALCANCAVEIS (sem commit apontando).
#      Os 668 blobs de node_modules/@supabase e .idea que pesam o .git estao
#      ALCANCAVEIS: foram commitados no upstream. Logo, gc sozinho NAO resolve.
#      Para eles e preciso reescrever o historico com git-filter-repo.
#
#  AVISO IMPORTANTE
#      --rewrite REESCREVE todos os commits. Os SHA mudam. Se existe um remote
#      (origin) apontando para o GitHub, o push sera rejeitado e exigira force.
#      Nada aqui envia nada para lugar nenhum: o script nao faz push.
# =============================================================================
set -euo pipefail

MODO="dry-run"
for arg in "$@"; do
  case "$arg" in
    --dry-run)  MODO="dry-run"  ;;
    --gc-only)  MODO="gc-only"  ;;
    --rewrite)  MODO="rewrite"  ;;
    -h|--help)  sed -n '2,25p' "$0"; exit 0 ;;
    *) echo "opcao desconhecida: $arg" >&2; exit 2 ;;
  esac
done

RAIZ="$(cd "$(dirname "$0")/.." && pwd)"
cd "$RAIZ"

# Caminhos a remover de TODO o historico.
CAMINHOS=(
  "node_modules"
  ".idea"
  ".vscode"
  "Conecta-Senac-main (frontend web +mobile)/.vscode"
  ".BACKUP"
)

echo "=============================================================="
echo " Limpeza do .git - modo: $MODO"
echo " repositorio: $RAIZ"
echo "=============================================================="
echo

antes_git=$(du -sm .git 2>/dev/null | cut -f1)
antes_arvore=$(du -sm --exclude=.git --exclude=node_modules --exclude=dist --exclude=.expo --exclude=build . 2>/dev/null | cut -f1)
echo "  .git antes         : ${antes_git} MB"
echo "  working tree antes : ${antes_arvore} MB"
echo

echo "-- objetos ALCANCAVEIS que serao removidos --"
total=0
for p in "${CAMINHOS[@]}"; do
  n=$(git rev-list --objects --all | grep -c -F "$p" || true)
  total=$((total + n))
  printf '   %-52s %s\n' "$p" "$n"
done
echo "   ------------------------------------------------------------"
printf '   %-52s %s\n' "TOTAL" "$total"
echo
echo "   (git-filter-repo e obrigatorio: --gc nao alcaca objetos commitados)"
echo

if [ "$MODO" = "dry-run" ]; then
  cat <<'AVISO'
=== NADA FOI ALTERADO (--dry-run) ===

Para aplicar:

  1) Somente reempacotamento (seguro, nao mexe no historico):
       git add -A && git commit -m "..."
       bash scripts/limpar-git.sh --gc-only

  2) Expurgar de verdade (reescreve todos os commits):
       git add -A && git commit -m "..."     # filter-repo recusa repo sujo
       pip install git-filter-repo
       bash scripts/limpar-git.sh --rewrite

  Antes do --rewrite, faca backup:  cp -a .git ../backup-git
AVISO
  exit 0
fi

# ------------------------------------------------------------------ comuns
if [ -n "$(git status --porcelain)" ]; then
  echo "ERRO: repo com alteracoes nao commitadas."
  echo "      git-filter-repo recusa working tree sujo."
  echo "      Commit ou descarte antes:"
  echo "        git add -A && git commit -m '...'"
  exit 1
fi

if [ "$MODO" = "gc-only" ]; then
  echo ">>> Etapa 1/3: expiracao de reflogs"
  git reflog expire --expire=now --expire-unreachable=now --all
  echo ">>> Etapa 2/3: prune imediato"
  git gc --prune=now --quiet
  echo ">>> Etapa 3/3: compactacao agressiva"
  git gc --prune=now --aggressive --quiet
  git repack -a -d -q --depth=50 --window=250
  deps_git=$(du -sm .git | cut -f1)
  echo
  echo ".git: ${antes_git} MB -> ${deps_git} MB"
  echo "ATENCAO: se o tamanho NAO caiu muito, os blobs estao ALCANCAVEIS."
  echo "          Use --rewrite para remove-los de fato."
  exit 0
fi

# ----------------------------------------------------------------- rewrite
command -v git-filter-repo >/dev/null 2>&1 || {
  echo "ERRO: git-filter-repo nao instalado."
  echo "      pip install git-filter-repo"
  echo "      (ou: pipx install git-filter-repo)"
  exit 1
}

if [ ! -d "../backup-git" ]; then
  echo ">>> Backup de seguranca do .git"
  cp -a .git ../backup-git
  echo "    criado: $(cd .. && pwd)/backup-git"
fi

echo ">>> git-filter-repo --sensitive-data-removal"
args=(--sensitive-data-removal)
for p in "${CAMINHOS[@]}"; do
  args+=(--path "$p" --invert-paths)
done
git filter-repo "${args[@]}"

echo ">>> reempacotamento"
git reflog expire --expire=now --expire-unreachable=now --all
git gc --prune=now --aggressive --quiet

deps_git=$(du -sm .git | cut -f1)
echo
echo "=============================================================="
echo " .git: ${antes_git} MB -> ${deps_git} MB"
echo "=============================================================="
git log --oneline -5
echo
cat <<'AVISO'
Pronto. O remoto 'origin' foi REMOVIDO de proposito pelo git-filter-repo
(medida de seguranca dele). Se o repositorio correto continuar sendo o
mesmo, readicione manualmente:

    git remote add origin <url-do-seu-repositorio>

Se voce NUNCAPretende publicar, pode deixar assim.
Este script NAO faz push - nada saiu do seu computador.
AVISO