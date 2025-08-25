# ========= OR-360 Large Checklist Seeder (Local) =========
# Runs against local Supabase. Inserts criteria from JSON into the selected project.
# ---------------------------------------------------------

# ==== CONFIG (Local dev) ====
$API = "http://127.0.0.1:54321"

# Local service_role key from your cheat sheet (superuser – for seeding only!)
$SERVICE_ROLE = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU"

# Full path to your Large checklist JSON
$JSON = "C:\projects\assureops-or360\or360-web\or360_enriched_large_full.json"

# (Optional) Hard-set a project ID to seed into (uncomment to use)
# $projectId = "35e00edf-4caf-4e75-a8b2-d91b06f97d75"

# (Optional) Wipe existing criteria before seeding (set $true to enable)
$WIPE_EXISTING = $false

# =========================================================

# --- Helpers ---
function Post-JsonUtf8 {
  param(
    [Parameter(Mandatory=$true)][string]$Uri,
    [Parameter(Mandatory=$true)][hashtable]$Headers,
    [Parameter(Mandatory=$true)][string]$Json
  )
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($Json)
  Invoke-RestMethod -Method Post -Uri $Uri -Headers $Headers -ContentType "application/json; charset=utf-8" -Body $bytes
}

function Delete-Json {
  param(
    [Parameter(Mandatory=$true)][string]$Uri,
    [Parameter(Mandatory=$true)][hashtable]$Headers
  )
  Invoke-RestMethod -Method Delete -Uri $Uri -Headers $Headers
}

# --- Headers for service_role seeding ---
$Headers = @{
  "apikey"        = $SERVICE_ROLE
  "Authorization" = "Bearer $SERVICE_ROLE"
  "Content-Type"  = "application/json; charset=utf-8"
  "Prefer"        = "return=representation"
}

# --- Sanity checks ---
if (-not (Test-Path $JSON)) {
  throw "JSON file not found: $JSON"
}

# --- Pick project (if not hard-set) ---
if (-not $projectId) {
  $proj = Invoke-RestMethod -Method Get -Uri "$API/rest/v1/projects?select=id,name&limit=1" -Headers $Headers
  if (-not $proj) {
    throw "No project found. Create one in Supabase Studio first (or hard-set \$projectId in this script)."
  }
  $projectId = $proj[0].id
}
Write-Host "Seeding into project: $projectId"

# --- SMOKE TEST: insert a tiny row to prove connectivity & UTF-8 body ---
try {
  $smoke = @{
    project_id = $projectId
    title      = "UTF-8 insert smoke test"
    status     = "not_started"
    category   = "Smoke"
    meta       = @{ description = "hello"; size = "L" }
  } | ConvertTo-Json -Depth 6

  Post-JsonUtf8 -Uri "$API/rest/v1/criteria" -Headers $Headers -Json $smoke | Out-Null
  Write-Host "Smoke test: OK (inserted 1 test row)."
} catch {
  Write-Warning "Smoke test failed. $_"
  Write-Warning "Check: API running? service_role correct? criteria table exists with category jsonb meta?"
  throw
}

# --- Optional: wipe existing criteria for this project ---
if ($WIPE_EXISTING) {
  try {
    Write-Host "Wiping existing criteria for project $projectId ..."
    Delete-Json -Uri "$API/rest/v1/criteria?project_id=eq.$projectId" -Headers $Headers
    Write-Host "Wipe complete."
  } catch {
    Write-Warning "Failed to wipe existing criteria: $_"
    throw
  }
}

# --- Load JSON ---
$data = Get-Content $JSON -Raw | ConvertFrom-Json

# --- Insert all items ---
$inserted = 0
$errors = 0

# Iterate top-level categories (object properties) -> arrays of items
$data.PSObject.Properties | ForEach-Object {
  $categoryName = $_.Name
  $_.Value | ForEach-Object {
    $item = $_

    # Build meta payload (kept in criteria.meta)
    $meta = @{
      description   = $item.description
      prompts       = $item.prompts
      priority      = $item.priority
      riskIfMissing = $item.riskIfMissing
      dependsOn     = $item.dependsOn
      pillar        = $item.pillar
      assuranceType = $item.assuranceType
      size          = "L"      # Tag this dataset as Large
      source        = "or360_enriched_large_full.json"
    }

    $body = @{
      project_id = $projectId
      title      = $item.item
      status     = "not_started"
      category   = $categoryName
      meta       = $meta
    } | ConvertTo-Json -Depth 10

    try {
      Post-JsonUtf8 -Uri "$API/rest/v1/criteria" -Headers $Headers -Json $body | Out-Null
      $inserted++
    } catch {
      $errors++
      Write-Warning "Failed to insert item: $($item.item)"
      Write-Warning "Body was: $body"
      Write-Warning $_
      throw  # Stop on first failure; comment this 'throw' if you prefer to continue
    }
  }
}

Write-Host "Done. Inserted $inserted criteria into project $projectId."
if ($errors -gt 0) {
  Write-Warning "Completed with $errors errors."
}

# --- Optional: remove the smoke test row so your list stays clean ---
try {
  Delete-Json -Uri "$API/rest/v1/criteria?project_id=eq.$projectId&category=eq.Smoke&title=eq.UTF-8%20insert%20smoke%20test" -Headers $Headers
} catch {
  # non-fatal
}
