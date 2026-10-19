<#
.SYNOPSIS
    Verifica (e opcionalmente corrige) a higiene do monorepo Conecta-Senac.

.DESCRIPTION
    Script idempotente e seguro por padrao: apenas LEITURA, sem tocar em
    nada, a menos que voce passe -Fix. Nao faz rede, nao chama git push, nao
    mexe em backend/demo/src, web/src ou mobile/src/app.

    Rodar de qualquer lugar dentro do repositorio:

        pwsh -File scripts/padronizar-monorepo.ps1
        pwsh -File scripts/padronizar-monorepo.ps1 -Fix

.EXAMPLE
    .\scripts\padronizar-monorepo.ps1
#>
[CmdletBinding()]
param(
    [switch]$Fix
)

$ErrorActionPreference = 'Stop'
$raiz = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$falhas = @()
$avisos = @()

function Ok   ($m) { Write-Host "  [ OK ] $m" -ForegroundColor Green }
function Aviso($m) { Write-Host "  [AVISO] $m" -ForegroundColor Yellow; $script:avisos += $m }
function Erro ($m) { Write-Host "  [FALHA] $m" -ForegroundColor Red;   $script:falhas += $m }
function Secao($t) { Write-Host "`n=== $t ===" -ForegroundColor Cyan }

# ---------------------------------------------------------------- 1. Wrapper
Secao '1. Gradle wrapper (backend/demo)'
$demo = Join-Path $raiz 'backend/demo'
foreach ($f in @('gradlew', 'gradlew.bat')) {
    $p = Join-Path $demo $f
    if (Test-Path $p) { Ok "$f presente" }
    else { Erro "$f AUSENTE - $('Linux/macOS' -eq $f) quebra" }
}
$prop = Join-Path $demo 'gradle/wrapper/gradle-wrapper.properties'
if (Test-Path $prop) {
    $url = (Select-String -Path $prop -Pattern '^distributionUrl=').Line
    Ok ("Gradle alvo: " + ($url -replace '^distributionUrl=', '' -replace '\\', ''))
} else { Erro 'gradle-wrapper.properties ausente' }
if (-not (Test-Path (Join-Path $demo 'gradle/wrapper/gradle-wrapper.jar'))) {
    Erro 'gradle-wrapper.jar ausente - o wrapper nao consegue baixar o Gradle'
}

# ------------------------------------------------------------ 2. .gitignore
Secao '2. .gitignore de IDE e dependencias'
$raizGitignore = Join-Path $raiz '.gitignore'
if (Test-Path $raizGitignore) {
    $txt = Get-Content $raizGitignore -Raw
    foreach ($pat in @('.idea', '.vscode', 'node_modules')) {
        if ($txt -match [regex]::Escape($pat)) { Ok "raiz/.gitignore cobre $pat" }
        else { Aviso "raiz/.gitignore nao menciona $pat" }
    }
} else { Erro '.gitignore da raiz ausente' }
foreach ($sub in @('web', 'server', 'mobile')) {
    $g = Join-Path $raiz "$sub/.gitignore"
    if (Test-Path $g) { Ok "$sub/.gitignore presente" }
    else { Aviso "$sub/.gitignore ausente" }
}

# ------------------------------------------------------------ 3. Estado Git
Secao '3. Estado do Git (somente leitura)'
Push-Location $raiz
try {
    $rastreadas = git ls-files
    $sujeiras = $rastreadas | Select-String -Pattern '(^|/)(node_modules|\.idea|\.vscode)/'
    if ($sujeiras) {
        Erro "$($sujeiras.Count) arquivo(s) de node_modules/.idea/.vscode RASTREADOS no indice:"
        $sujeiras | Select-Object -First 10 | ForEach-Object { Write-Host "         $_" -ForegroundColor Red }
        Write-Host '         rode scripts/limpar-git.sh para expurgar do historico' -ForegroundColor Yellow
    } else { Ok 'nenhum node_modules/.idea/.vscode rastreado' }

    $head = git log --oneline -1
    $porAtras = (git status --porcelain | Measure-Object).Count
    Ok "HEAD: $head"
    if ($porAtras -gt 0) { Aviso "$porAtras alteracao(oes) nao commitada(s) no indice ou working tree" }
} finally { Pop-Location }

# ------------------------------------------------------------- 4. Mobile
Secao '4. Mobile - assets e tipos'
$assets = Join-Path $raiz 'mobile/src/constants/assets.ts'
if (Test-Path $assets) {
    $m = Select-String -Path $assets -Pattern "require\('([^']+)'\)" | Select-Object -First 1
    if ($m) {
        $rel = $m.Matches[0].Groups[1].Value
        $abs = [System.IO.Path]::GetFullPath((Join-Path (Split-Path $assets) $rel))
        if (Test-Path $abs) { Ok "assets.ts -> $rel resolve" }
        else { Erro "assets.ts -> $rel NAO RESOLVE (caminho obsoleto apos a reorganizacao)" }
    }
} else { Aviso 'assets.ts ausente' }
foreach ($p in @('mobile/package.json', 'mobile/tsconfig.json', 'mobile/app.json')) {
    if (Test-Path (Join-Path $raiz $p)) { Ok $p } else { Erro "$p ausente" }
}

# ---------------------------------------------------------------- 5. Docs
Secao '5. Documentacao'
$docs = Join-Path $raiz 'docs'
if (Test-Path $docs) {
    $txts = Get-ChildItem $docs -Filter '*.txt' -File -ErrorAction SilentlyContinue
    if ($txts) { Aviso "$($txts.Count) .txt em docs/ (padrao do repo e .md): $($txts.Name -join ', ')" }
    else { Ok 'docs/ sem .txt' }
    if (Test-Path (Join-Path $docs 'README.md')) { Aviso 'docs/README.md presente (duplica o README da raiz)' }
    else { Ok 'sem README duplicado em docs/' }
} else { Aviso 'pasta docs/ ausente' }

# -------------------------------------------------------------- 6. Pesos
Secao '6. Peso em disco'
$gitBytes = (Get-ChildItem (Join-Path $raiz '.git') -Recurse -File -Force -EA SilentlyContinue |
             Measure-Object Length -Sum).Sum
# node_modules e build sao installs, nao conteudo do repo: nao contam no peso.
$treeBytes = (Get-ChildItem $raiz -Recurse -File -Force -EA SilentlyContinue |
              Where-Object { $_.FullName -notmatch '[\\/]\.git[\\/]' -and
                            $_.FullName -notmatch '[\\/]node_modules[\\/]' -and
                            $_.FullName -notmatch '[\\/]dist[\\/]' -and
                            $_.FullName -notmatch '[\\/]\.expo[\\/]' -and
                            $_.FullName -notmatch '[\\/]build[\\/]' } |
              Measure-Object Length -Sum).Sum
Write-Host ("  .git          : {0:N2} MB" -f ($gitBytes / 1MB))
Write-Host ("  working tree  : {0:N2} MB" -f ($treeBytes / 1MB))
if ($treeBytes -gt 0 -and $gitBytes -gt ($treeBytes * 0.5)) {
    Aviso ('.git ocupa {0:P0} do conteudo real do repo - o historico carrega blobs orfaos' -f ($gitBytes / ($gitBytes + $treeBytes)))
    Aviso '  >> rode: bash scripts/limpar-git.sh --dry-run   (para ver o plano)'
}

# ------------------------------------------------------------ 7. Resumo
Write-Host ''
Write-Host ("RESUMO: {0} falha(s), {1} aviso(s)" -f $falhas.Count, $avisos.Count) -ForegroundColor $(if($falhas.Count){'Red'}else{'Green'})
if ($falhas.Count -gt 0) { exit 1 }
exit 0