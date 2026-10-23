<#
.NOTAS IMPORTANTES
===================
- Knasta.cl NO ofrece una API oficial pública.
- El endpoint /api/results es interno y puede cambiar o ser bloqueado sin aviso.
- Este script intenta usarlo, pero si falla, recurre a precios referenciales estáticos.
- Úsalo solo para pruebas personales; NO para sistemas productivos.
#>

# Mostrar nota importante al inicio
Write-Host "`n========== NOTA IMPORTANTE ==========" -ForegroundColor Red
Write-Host "Knasta.cl NO tiene API oficial." -ForegroundColor Red
Write-Host "El endpoint interno puede fallar o cambiar en cualquier momento." -ForegroundColor Red
Write-Host "Si la API no responde, se usaran precios referenciales estaticos." -ForegroundColor Red
Write-Host "=====================================" -ForegroundColor Red

# Lista de productos (10 ítems semanales)
$productos = @(
    @{Nombre = "leche"; Cantidad = "2 litros"; Unidad = "litro"},
    @{Nombre = "pan"; Cantidad = "1 bolsa"; Unidad = "unidad"},
    @{Nombre = "huevos"; Cantidad = "12 unidades"; Unidad = "docena"},
    @{Nombre = "arroz"; Cantidad = "1 kg"; Unidad = "kg"},
    @{Nombre = "fideos"; Cantidad = "500 g"; Unidad = "paquete"},
    @{Nombre = "pollo"; Cantidad = "1 bandeja (800g)"; Unidad = "bandeja"},
    @{Nombre = "tomates"; Cantidad = "1 kg"; Unidad = "kg"},
    @{Nombre = "lechuga"; Cantidad = "1 unidad"; Unidad = "unidad"},
    @{Nombre = "platanos"; Cantidad = "1 manojo"; Unidad = "manojo"},
    @{Nombre = "papel higienico"; Cantidad = "4 rollos"; Unidad = "paquete"}
)

# Precios referenciales estáticos (CLP, mayo 2026) - usados como fallback
$preciosEstaticos = @{
    "leche" = @{Precio = 1100; Tienda = "Referencial"}
    "pan" = @{Precio = 1800; Tienda = "Referencial"}
    "huevos" = @{Precio = 3200; Tienda = "Referencial"}
    "arroz" = @{Precio = 1300; Tienda = "Referencial"}
    "fideos" = @{Precio = 900; Tienda = "Referencial"}
    "pollo" = @{Precio = 4500; Tienda = "Referencial"}
    "tomates" = @{Precio = 1200; Tienda = "Referencial"}
    "lechuga" = @{Precio = 800; Tienda = "Referencial"}
    "platanos" = @{Precio = 1500; Tienda = "Referencial"}
    "papel higienico" = @{Precio = 2500; Tienda = "Referencial"}
}

# Directorio de salida
$directorio = if ($PSScriptRoot) { $PSScriptRoot } else { Get-Location }
$archivoDetalle = Join-Path $directorio "resultados_detalle.csv"
$archivoResumen = Join-Path $directorio "resumen_semanal.csv"

$resultados = @()

# Función para limpiar precio (quitar $ y puntos)
function Parse-Precio($precioRaw) {
    if (-not $precioRaw) { return $null }
    $numero = [regex]::Match($precioRaw, "[\d\.]+").Value -replace '\.', ''
    if ($numero) { return [int]$numero }
    return $null
}

Write-Host "`nConsultando API de Knasta..." -ForegroundColor Cyan

foreach ($item in $productos) {
    $producto = $item.Nombre
    Write-Host "`n🔍 $producto" -ForegroundColor Yellow
    
    $url = "https://knasta.cl/api/results?q=$producto&page=1"
    $encontrado = $false
    $nombreReal = ""
    $precioNum = $null
    $tienda = ""
    $link = ""
    $fuente = ""

    try {
        $response = Invoke-RestMethod -Uri $url -Headers @{"User-Agent" = "Mozilla/5.0"} -TimeoutSec 5 -ErrorAction Stop
        $primer = $response.products[0]
        if ($primer -and $primer.price) {
            $nombreReal = $primer.name
            $precioNum = Parse-Precio $primer.price
            $tienda = $primer.store
            $link = $primer.url
            $fuente = "API Knasta"
            $encontrado = $true
            Write-Host "  ✅ API: $nombreReal - $($primer.price) en $tienda" -ForegroundColor Green
        } else {
            throw "No se encontró producto en API"
        }
    }
    catch {
        Write-Host "  ⚠️ API falló. Usando precio referencial." -ForegroundColor Magenta
        if ($preciosEstaticos.ContainsKey($producto)) {
            $referencia = $preciosEstaticos[$producto]
            $nombreReal = "$producto (referencial)"
            $precioNum = $referencia.Precio
            $tienda = $referencia.Tienda
            $link = "N/A"
            $fuente = "Estático (fallback)"
            $encontrado = $true
            Write-Host "  📊 Referencial: $nombreReal - $($precioNum) CLP" -ForegroundColor Yellow
        } else {
            $nombreReal = "No disponible"
            $precioNum = $null
            $tienda = "Error"
            $link = "N/A"
            $fuente = "Error"
            Write-Host "  ❌ No hay datos para este producto." -ForegroundColor Red
        }
    }

    $resultados += [PSCustomObject]@{
        ProductoBuscado  = $producto
        CantidadSemanal  = $item.Cantidad
        NombreEncontrado = $nombreReal
        PrecioCLP        = $precioNum
        Tienda           = $tienda
        Link             = $link
        Fuente           = $fuente
    }
    
    Start-Sleep -Milliseconds 500
}

# Exportar detalle a CSV
$resultados | Export-Csv -Path $archivoDetalle -NoTypeInformation -Encoding UTF8
Write-Host "`n📄 Detalle exportado a: $archivoDetalle" -ForegroundColor Green

# --- Resumen semanal: total por tienda y gasto total ---
$resumen = @()
$totalGeneral = 0

$grupos = $resultados | Where-Object { $_.PrecioCLP -and $_.PrecioCLP -ne "Error" } | Group-Object Tienda

foreach ($grupo in $grupos) {
    $subtotal = ($grupo.Group | Measure-Object -Property PrecioCLP -Sum).Sum
    $totalGeneral += $subtotal
    $resumen += [PSCustomObject]@{
        Tienda       = $grupo.Name
        Productos    = $grupo.Count
        SubtotalCLP  = $subtotal
    }
}

# Agregar fila de total general
$resumen += [PSCustomObject]@{
    Tienda       = "TOTAL GENERAL"
    Productos    = ($resultados | Where-Object { $_.PrecioCLP -and $_.PrecioCLP -ne "Error" }).Count
    SubtotalCLP  = $totalGeneral
}

$resumen | Export-Csv -Path $archivoResumen -NoTypeInformation -Encoding UTF8
Write-Host "📊 Resumen semanal exportado a: $archivoResumen" -ForegroundColor Green

# Mostrar resumen en consola
Write-Host "`n========== RESUMEN DE GASTO SEMANAL ==========" -ForegroundColor Cyan
$resumen | Format-Table -AutoSize

Write-Host "`nNota: Los precios obtenidos via API son en tiempo real; los estáticos son referenciales (mayo 2026)." -ForegroundColor DarkYellow
Write-Host "Script finalizado. Revisa los archivos CSV en: $directorio`n" -ForegroundColor Magenta