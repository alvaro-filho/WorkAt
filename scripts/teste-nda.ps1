param(
    [string]$BaseUrl = "http://localhost:8080/api/v1"
)

$ErrorActionPreference = "Stop"
$script:Failures = 0

function Req {
    param(
        [Parameter(Mandatory)][string]$Method,
        [Parameter(Mandatory)][string]$Path,
        [object]$Body,
        [string]$Token
    )

    $headers = @{}
    if ($Token) { $headers.Authorization = "Bearer $Token" }
    $request = @{
        Uri = "$BaseUrl$Path"
        Method = $Method
        Headers = $headers
        SkipHttpErrorCheck = $true
    }
    if ($null -ne $Body) {
        $request.ContentType = "application/json"
        $request.Body = ConvertTo-Json -InputObject $Body -Depth 8 -Compress
    }

    try {
        $response = Invoke-WebRequest @request
        $raw = $response.Content
        $data = $null
        if (-not [string]::IsNullOrWhiteSpace($raw)) {
            try { $data = ConvertFrom-Json -InputObject $raw } catch { $data = $raw }
        }
        return [pscustomobject]@{ Status = [int]$response.StatusCode; Data = $data; Raw = $raw }
    } catch {
        return [pscustomobject]@{ Status = 0; Data = $null; Raw = $_.Exception.Message }
    }
}

function Checa {
    param(
        [Parameter(Mandatory)][string]$Name,
        [Parameter(Mandatory)][object]$Actual,
        [Parameter(Mandatory)][object]$Expected
    )

    if ($Actual -eq $Expected) {
        Write-Host "OK $Name"
    } else {
        $script:Failures++
        Write-Host "FALHA $Name esperado $Expected, veio $Actual"
    }
}

function Login {
    param(
        [Parameter(Mandatory)][string]$Email,
        [Parameter(Mandatory)][ValidateSet("ARTIST", "COMPANY")][string]$Role,
        [Parameter(Mandatory)][string]$Password
    )

    $loginBody = @{ email = $Email; password = $Password }
    $loginResponse = Req -Method POST -Path "/auth/login" -Body $loginBody
    if ($loginResponse.Status -eq 200 -and $loginResponse.Data.token) {
        Write-Host "OK Login $Email"
        return [string]$loginResponse.Data.token
    }

    $username = ($Email.Split("@")[0] -replace "[^a-zA-Z0-9_]", "")
    $registerBody = @{
        fullName = if ($Role -eq "ARTIST") { "Artista de teste" } else { "Empresa de teste" }
        username = $username
        email = $Email
        password = $Password
        role = $Role
    }
    $registered = Req -Method POST -Path "/auth/register" -Body $registerBody
    if ($registered.Status -eq 201) {
        $loginResponse = Req -Method POST -Path "/auth/login" -Body $loginBody
        if ($loginResponse.Status -eq 200 -and $loginResponse.Data.token) {
            Write-Host "OK Cadastro e login $Email ($Role)"
            return [string]$loginResponse.Data.token
        }
    }

    Checa -Name "Login/cadastro $Email ($Role)" -Actual $loginResponse.Status -Expected 200
    return $null
}

$securePassword = Read-Host "Senha de teste (mínimo 8 caracteres, maiúscula, minúscula e número)" -AsSecureString
$passwordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
try {
    $password = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPointer)
} finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPointer)
}

$artistToken = Login -Email "artista@teste.com" -Role ARTIST -Password $password
$artist2Token = Login -Email "artista2@teste.com" -Role ARTIST -Password $password
$companyToken = Login -Email "empresa@teste.com" -Role COMPANY -Password $password
$company2Token = Login -Email "empresa3@teste.com" -Role COMPANY -Password $password
$password = $null
$securePassword.Dispose()

$title = "Teste NDA $(Get-Date -Format 'yyyyMMddHHmmss')"
$createBody = @{
    title = $title
    description = "Item criado pelo teste automatizado de NDA"
    companyEmail = "empresa@teste.com"
}

$create = Req -Method POST -Path "/showcase" -Body $createBody -Token $artistToken
Checa "Artista cria arte" $create.Status 201
$artId = $create.Data.id
Checa "Arte nasce travada" $create.Data.ndaStatus "LOCKED_BY_NDA"

$invalidArtistCompany = Req -Method POST -Path "/showcase" -Body @{
    title = $title; companyEmail = "artista@teste.com"
} -Token $artistToken
Checa "E-mail de artista não é empresa" $invalidArtistCompany.Status 400
$missingCompany = Req -Method POST -Path "/showcase" -Body @{
    title = $title; companyEmail = "inexistente@teste.com"
} -Token $artistToken
Checa "Empresa inexistente" $missingCompany.Status 400
$companyCreate = Req -Method POST -Path "/showcase" -Body $createBody -Token $companyToken
Checa "Empresa não cria arte" $companyCreate.Status 403
$anonymousCreate = Req -Method POST -Path "/showcase" -Body $createBody
Checa "POST sem token" $anonymousCreate.Status 403

$public = Req -Method GET -Path "/showcase/public"
Checa "Vitrine pública responde" $public.Status 200
Checa "Arte travada ausente do público" (@($public.Data | Where-Object { $_.id -eq $artId }).Count) 0

$artistPatch = Req -Method PATCH -Path "/showcase/$artId/nda-status" -Body @{
    status = "APPROVED_FOR_RELEASE"
} -Token $artistToken
Checa "Artista não altera NDA" $artistPatch.Status 403
$otherCompanyPatch = Req -Method PATCH -Path "/showcase/$artId/nda-status" -Body @{
    status = "APPROVED_FOR_RELEASE"
} -Token $company2Token
Checa "Outra empresa não altera item" $otherCompanyPatch.Status 404
$otherInbox = Req -Method GET -Path "/showcase/inbox" -Token $company2Token
Checa "Inbox de outra empresa responde" $otherInbox.Status 200
Checa "Inbox de outra empresa não contém item" (@($otherInbox.Data | Where-Object { $_.id -eq $artId }).Count) 0

$rejectWithoutNote = Req -Method PATCH -Path "/showcase/$artId/nda-status" -Body @{
    status = "LOCKED_BY_NDA"
} -Token $companyToken
Checa "Recusa exige justificativa" $rejectWithoutNote.Status 400
$rejected = Req -Method PATCH -Path "/showcase/$artId/nda-status" -Body @{
    status = "LOCKED_BY_NDA"; note = "Contrato ainda vigente"
} -Token $companyToken
Checa "Recusar com justificativa" $rejected.Status 200
$public = Req -Method GET -Path "/showcase/public"
Checa "Vitrine pública após recusa responde" $public.Status 200
Checa "Arte recusada ausente do público" (@($public.Data | Where-Object { $_.id -eq $artId }).Count) 0

$pastApproval = Req -Method PATCH -Path "/showcase/$artId/nda-status" -Body @{
    status = "APPROVED_FOR_RELEASE"; releaseDate = (Get-Date).Date.AddDays(-1).ToString("yyyy-MM-dd")
} -Token $companyToken
Checa "Data de aprovação passada" $pastApproval.Status 400
$futureApproval = Req -Method PATCH -Path "/showcase/$artId/nda-status" -Body @{
    status = "APPROVED_FOR_RELEASE"; releaseDate = (Get-Date).Date.AddDays(2).ToString("yyyy-MM-dd")
} -Token $companyToken
Checa "Aprovação com data futura" $futureApproval.Status 200
$public = Req -Method GET -Path "/showcase/public"
Checa "Vitrine pública após aprovação futura responde" $public.Status 200
Checa "Arte com data futura ausente do público" (@($public.Data | Where-Object { $_.id -eq $artId }).Count) 0

$immediateApproval = Req -Method PATCH -Path "/showcase/$artId/nda-status" -Body @{
    status = "APPROVED_FOR_RELEASE"
} -Token $companyToken
Checa "Aprovação sem data" $immediateApproval.Status 200
$public = Req -Method GET -Path "/showcase/public"
Checa "Vitrine pública após aprovação responde" $public.Status 200
$publicArt = @($public.Data | Where-Object { $_.id -eq $artId })
Checa "Arte aprovada sem data aparece" $publicArt.Count 1
$publicJson = ConvertTo-Json -InputObject $publicArt -Depth 8 -Compress
Checa "JSON público não contém e-mail" ($publicJson -match 'email') $false
Checa "JSON público não contém reviewNote" ($publicJson -match 'reviewNote') $false
Checa "JSON público não contém IDs de usuário" ($publicJson -match 'artistId|companyId|userId|user_id|createdByUserId|companyUserId') $false

$revoked = Req -Method PATCH -Path "/showcase/$artId/nda-status" -Body @{
    status = "LOCKED_BY_NDA"; note = "Liberação revogada pelo teste"
} -Token $companyToken
Checa "Revogar liberação" $revoked.Status 200
$public = Req -Method GET -Path "/showcase/public"
Checa "Vitrine pública após revogação responde" $public.Status 200
Checa "Item revogado some do público" (@($public.Data | Where-Object { $_.id -eq $artId }).Count) 0

$artist2Mine = Req -Method GET -Path "/showcase/mine" -Token $artist2Token
Checa "Minhas artes do segundo artista responde" $artist2Mine.Status 200
Checa "Outro artista não vê item" (@($artist2Mine.Data | Where-Object { $_.id -eq $artId }).Count) 0
$anonymousMine = Req -Method GET -Path "/showcase/mine"
Checa "GET mine sem token" $anonymousMine.Status 403

if ($script:Failures -gt 0) {
    Write-Host "FALHA Total de verificações com erro: $script:Failures"
    exit 1
}
Write-Host "OK Todos os testes de NDA passaram"
