# ────────────────────────────────────────────────────────────────────────────
# Deja el servicio de impresión arrancando SOLO al encender el PC del bar.
#
#   powershell -ExecutionPolicy Bypass -File scripts\instalar-impresion.ps1
#   …                                                          -Quitar
#   …                                                          -Estado
#
# POR QUÉ: hasta ahora la impresión había que levantarla a mano cada vez, y en
# un bar eso significa que el primer día que nadie se acuerde, las comandas
# dejan de salir. Es lo único que separaba el montaje de uno de verdad.
#
# NO PIDE ADMINISTRADOR, a propósito: se registra como tarea del usuario que
# usa el TPV y arranca al iniciar sesión. Arrancar "con el sistema" sí
# exigiría elevación, y el PC de un bar entra solo a su sesión de todos modos.
# Es la misma decisión que se tomó con las impresoras (driver genérico + RAW).
# ────────────────────────────────────────────────────────────────────────────
param(
  [switch]$Quitar,
  [switch]$Estado
)

$ErrorActionPreference = 'Stop'
$nombreTarea = 'TPV Marchando - Impresion'
$raiz = Split-Path -Parent $PSScriptRoot
$vbs = Join-Path $raiz 'scripts\impresion-oculta.vbs'

# Con los cmdlets de tareas y no con `schtasks`: en PowerShell 5.1, redirigir
# la salida de un .exe nativo la convierte en error y el script se cae solo.
function Tarea {
  Get-ScheduledTask -TaskName $nombreTarea -ErrorAction SilentlyContinue
}
function Existe { return $null -ne (Tarea) }

# ── Estado ──────────────────────────────────────────────────────────────────
if ($Estado) {
  $t = Tarea
  if (-not $t) {
    Write-Host "La tarea NO esta instalada." -ForegroundColor Yellow
    Write-Host "  Instalala con: powershell -ExecutionPolicy Bypass -File scripts\instalar-impresion.ps1"
    exit 1
  }
  $info = Get-ScheduledTaskInfo -TaskName $nombreTarea
  Write-Host "Tarea:          $($t.TaskName)"
  Write-Host "Estado:         $($t.State)"
  Write-Host "Ultima vez:     $($info.LastRunTime)  (resultado $($info.LastTaskResult))"
  Write-Host "Proxima vez:    $($info.NextRunTime)"

  $vivo = Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
    Where-Object { $_.CommandLine -like '*impresion-automatica*' }
  if ($vivo) {
    Write-Host "Proceso:        CORRIENDO (PID $($vivo.ProcessId))" -ForegroundColor Green
  } else {
    Write-Host "Proceso:        no esta corriendo" -ForegroundColor Yellow
  }

  $log = Join-Path $raiz 'logs\impresion.log'
  if (Test-Path $log) {
    Write-Host "`nUltimas lineas de logs\impresion.log:" -ForegroundColor Cyan
    # -Encoding UTF8 a proposito: node escribe UTF-8 y PowerShell 5.1 lee en la
    # codificacion del sistema, asi que sin esto los acentos salen como basura.
    Get-Content $log -Tail 6 -Encoding UTF8
  } else {
    Write-Host "`nTodavia no hay logs\impresion.log (la tarea no ha llegado a arrancar)."
  }
  exit 0
}

# ── Quitar ──────────────────────────────────────────────────────────────────
if ($Quitar) {
  if (-not (Existe)) { Write-Host "No estaba instalada."; exit 0 }
  Unregister-ScheduledTask -TaskName $nombreTarea -Confirm:$false
  Write-Host "OK - tarea eliminada. La impresion ya no arrancara sola." -ForegroundColor Green
  Write-Host "   (el proceso que este corriendo ahora sigue vivo hasta que cierres sesion)"
  exit 0
}

# ── Instalar ────────────────────────────────────────────────────────────────
if (-not (Test-Path $vbs)) { throw "No encuentro $vbs" }

$nodo = (Get-Command node -ErrorAction SilentlyContinue)
if (-not $nodo) { throw "node no esta en el PATH: instala Node.js en este PC antes de continuar." }

$env2 = Join-Path $raiz '.env.puente'
if (-not (Test-Path $env2)) {
  Write-Host "AVISO: no hay .env.puente en $raiz" -ForegroundColor Yellow
  Write-Host "       La tarea se instalara igual, pero la impresion no arrancara"
  Write-Host "       hasta que ese fichero exista con SUPABASE_URL y SUPABASE_SERVICE_KEY.`n"
}

$usuario = "$env:USERDOMAIN\$env:USERNAME"

# Se define por XML y no con los parametros de schtasks porque solo asi se
# puede pedir lo que de verdad importa en un bar: que si el proceso se cae, se
# vuelva a levantar solo; que no se pare por estar en bateria (los TPV suelen
# tener SAI); y que si el PC estaba apagado a su hora, arranque igual al
# encenderlo.
$xml = @"
<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.3" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <RegistrationInfo>
    <Description>Imprime las comandas del TPV sin navegador. Se instala con scripts\instalar-impresion.ps1</Description>
  </RegistrationInfo>
  <Triggers>
    <LogonTrigger>
      <Enabled>true</Enabled>
      <UserId>$usuario</UserId>
      <Delay>PT20S</Delay>
    </LogonTrigger>
  </Triggers>
  <Principals>
    <Principal id="Author">
      <UserId>$usuario</UserId>
      <LogonType>InteractiveToken</LogonType>
      <RunLevel>LeastPrivilege</RunLevel>
    </Principal>
  </Principals>
  <Settings>
    <MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>
    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>
    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>
    <StartWhenAvailable>true</StartWhenAvailable>
    <RunOnlyIfNetworkAvailable>false</RunOnlyIfNetworkAvailable>
    <IdleSettings>
      <StopOnIdleEnd>false</StopOnIdleEnd>
      <RestartOnIdle>false</RestartOnIdle>
    </IdleSettings>
    <AllowStartOnDemand>true</AllowStartOnDemand>
    <Enabled>true</Enabled>
    <Hidden>false</Hidden>
    <RestartOnFailure>
      <Interval>PT1M</Interval>
      <Count>3</Count>
    </RestartOnFailure>
    <ExecutionTimeLimit>PT0S</ExecutionTimeLimit>
  </Settings>
  <Actions Context="Author">
    <Exec>
      <Command>wscript.exe</Command>
      <Arguments>"$vbs"</Arguments>
      <WorkingDirectory>$raiz</WorkingDirectory>
    </Exec>
  </Actions>
</Task>
"@

if (Existe) { Unregister-ScheduledTask -TaskName $nombreTarea -Confirm:$false }
Register-ScheduledTask -TaskName $nombreTarea -Xml $xml | Out-Null

if (-not (Existe)) { throw "Windows dijo que si, pero la tarea no aparece." }

Write-Host "OK - instalada: `"$nombreTarea`"" -ForegroundColor Green
Write-Host "   Arranca sola 20 s despues de iniciar sesion en este PC."
Write-Host "   Si el proceso se cae, Windows lo reintenta 3 veces (cada minuto)."
Write-Host "   Salida en: logs\impresion.log"
Write-Host ""
Write-Host "   Comprobar:  powershell -ExecutionPolicy Bypass -File scripts\instalar-impresion.ps1 -Estado"
Write-Host "   Quitar:     powershell -ExecutionPolicy Bypass -File scripts\instalar-impresion.ps1 -Quitar"
