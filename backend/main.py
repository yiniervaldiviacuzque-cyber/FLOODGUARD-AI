from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pathlib import Path
from datetime import datetime, timezone
import random
import json
import time
import httpx

ROOT = Path(__file__).resolve().parent.parent
app = FastAPI(title="FLOODGUARD AI", version="4.0.0")

app.mount("/static", StaticFiles(directory=ROOT / "static"), name="static")

DEPARTMENTS = {
    "Amazonas": (-6.23, -77.87, "Chachapoyas"),
    "Áncash": (-9.53, -77.53, "Huaraz"),
    "Apurímac": (-13.64, -72.88, "Abancay"),
    "Arequipa": (-16.40, -71.54, "Arequipa"),
    "Ayacucho": (-13.16, -74.22, "Ayacucho"),
    "Cajamarca": (-7.16, -78.51, "Cajamarca"),
    "Callao": (-12.06, -77.15, "Callao"),
    "Cusco": (-13.52, -71.97, "Cusco"),
    "Huancavelica": (-12.79, -74.97, "Huancavelica"),
    "Huánuco": (-9.93, -76.24, "Huánuco"),
    "Ica": (-14.07, -75.73, "Ica"),
    "Junín": (-12.07, -75.21, "Huancayo"),
    "La Libertad": (-8.11, -79.03, "Trujillo"),
    "Lambayeque": (-6.77, -79.84, "Chiclayo"),
    "Lima": (-12.05, -77.04, "Lima"),
    "Loreto": (-3.75, -73.25, "Iquitos"),
    "Madre de Dios": (-12.59, -69.19, "Puerto Maldonado"),
    "Moquegua": (-17.19, -70.94, "Moquegua"),
    "Pasco": (-10.68, -76.26, "Cerro de Pasco"),
    "Piura": (-5.19, -80.63, "Piura"),
    "Puno": (-15.84, -70.02, "Puno"),
    "San Martín": (-6.03, -76.97, "Moyobamba"),
    "Tacna": (-18.01, -70.25, "Tacna"),
    "Tumbes": (-3.57, -80.45, "Tumbes"),
    "Ucayali": (-8.38, -74.53, "Pucallpa")
}

national_cache = {"timestamp": 0, "data": None}


@app.get("/")
def home():
    return FileResponse(ROOT / "templates" / "index.html")


@app.get("/api/health")
def health():
    return {
        "status": "online",
        "application": "FLOODGUARD AI",
        "version": "4.0.0"
    }


@app.get("/api/departamentos")
def departamentos():
    path = ROOT / "static" / "departments.geojson"
    if not path.exists():
        return {"error": "No se encontró el archivo geográfico"}
    with open(path, encoding="utf-8") as f:
        return json.load(f)


@app.get("/api/clima/nacional")
async def clima_nacional(actualizar: bool = False):
    # Caché de 10 minutos para evitar consultas innecesarias
    if not actualizar and national_cache["data"] and time.time() - national_cache["timestamp"] < 300:
        return national_cache["data"]

    names = list(DEPARTMENTS.keys())
    latitudes = ",".join(str(DEPARTMENTS[n][0]) for n in names)
    longitudes = ",".join(str(DEPARTMENTS[n][1]) for n in names)

    params = {
        "latitude": latitudes,
        "longitude": longitudes,
        "current": (
            "temperature_2m,relative_humidity_2m,precipitation,"
            "weather_code,wind_speed_10m"
        ),
        "timezone": "auto"
    }

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.get(
                "https://api.open-meteo.com/v1/forecast",
                params=params
            )
            response.raise_for_status()
            weather_data = response.json()

        # La API devuelve una lista cuando se consultan varias ubicaciones.
        if isinstance(weather_data, dict):
            weather_data = [weather_data]

        results = []
        for name, item in zip(names, weather_data):
            current = item.get("current", {})
            lat, lon, capital = DEPARTMENTS[name]

            results.append({
                "department": name,
                "capital": capital,
                "latitude": lat,
                "longitude": lon,
                "temperature": current.get("temperature_2m"),
                "humidity": current.get("relative_humidity_2m"),
                "precipitation": current.get("precipitation"),
                "wind": current.get("wind_speed_10m"),
                "weather_code": current.get("weather_code"),
                "time": current.get("time")
            })

        result = {
            "source": "Open-Meteo",
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "count": len(results),
            "departments": results,
            "notice": "Datos de modelo meteorológico en puntos de referencia de las capitales; no son mediciones directas de estaciones."
        }

        national_cache["timestamp"] = time.time()
        national_cache["data"] = result
        return result

    except (httpx.HTTPError, ValueError) as error:
        raise HTTPException(
            status_code=502,
            detail=f"No se pudo consultar el servicio meteorológico: {str(error)}"
        )




@app.get("/api/clima/departamento")
async def clima_departamento(departamento: str):
    """
    Consulta condiciones actuales y pronóstico mediante Open-Meteo.
    Son datos de modelo meteorológico, no lecturas directas de SENAMHI.
    """
    if departamento not in DEPARTMENTS:
        raise HTTPException(status_code=400, detail="Departamento no válido.")

    lat, lon, capital = DEPARTMENTS[departamento]

    params = {
        "latitude": lat,
        "longitude": lon,
        "current": (
            "temperature_2m,relative_humidity_2m,apparent_temperature,"
            "precipitation,weather_code,wind_speed_10m,"
            "wind_gusts_10m,pressure_msl"
        ),
        "hourly": (
            "temperature_2m,relative_humidity_2m,precipitation,"
            "precipitation_probability,wind_speed_10m"
        ),
        "daily": (
            "temperature_2m_max,temperature_2m_min,"
            "precipitation_sum,precipitation_probability_max"
        ),
        "forecast_days": 2,
        "timezone": "auto"
    }

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.get(
                "https://api.open-meteo.com/v1/forecast",
                params=params
            )
            response.raise_for_status()
            data = response.json()

        return {
            "department": departamento,
            "capital": capital,
            "latitude": lat,
            "longitude": lon,
            "source": "Open-Meteo",
            "data_type": "MODELO METEOROLÓGICO",
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "timezone": data.get("timezone"),
            "current": data.get("current", {}),
            "hourly": data.get("hourly", {}),
            "daily": data.get("daily", {}),
            "notice": (
                "Información meteorológica de modelo para las coordenadas "
                "de referencia de la capital. No es una medición directa "
                "de una estación física."
            )
        }

    except (httpx.HTTPError, ValueError) as error:
        raise HTTPException(
            status_code=502,
            detail=f"No se pudo consultar Open-Meteo: {str(error)}"
        )


@app.get("/api/fuentes")
def fuentes():
    return {
        "sources": [
            {
                "name": "SENAMHI - Estaciones hidrometeorológicas",
                "type": "OFICIAL - OBSERVACIONES",
                "url": "https://www.senamhi.gob.pe/servicios/?p=estaciones",
                "description": "Consulta de estaciones meteorológicas e hidrológicas del Perú."
            },
            {
                "name": "SENAMHI - Estaciones de Huánuco",
                "type": "OFICIAL - OBSERVACIONES",
                "url": "https://www.senamhi.gob.pe/servicios/main.php?dp=huanuco&p=estaciones",
                "description": "Consulta de estaciones del departamento de Huánuco."
            },
            {
                "name": "SENAMHI - Mapa de estaciones",
                "type": "OFICIAL - MAPA",
                "url": "https://www.senamhi.gob.pe/mapas/mapa-estaciones-2/",
                "description": "Mapa de estaciones convencionales y automáticas."
            },
            {
                "name": "SENAMHI - WIS 2.0",
                "type": "OFICIAL - INTERCAMBIO METEOROLÓGICO",
                "url": "https://wis.senamhi.gob.pe/oapi/collections?f=html",
                "description": "Catálogo de observaciones sinópticas horarias y estaciones."
            },
            {
                "name": "SENAMHI - Datos abiertos GBON/RBON",
                "type": "OFICIAL - DATOS ABIERTOS",
                "url": "https://www.datosabiertos.gob.pe/dataset/variables-meteorol%C3%B3gicas-de-las-estaciones-autom%C3%A1ticas-de-intercambio-internacional-servicio",
                "description": "Registros de estaciones automáticas: temperatura, humedad y precipitación."
            },
            {
                "name": "ANA - Sistema Nacional de Información de Recursos Hídricos",
                "type": "OFICIAL - HIDROLOGÍA",
                "url": "https://snirh.ana.gob.pe/observatoriosnirh/Index.aspx",
                "description": "Información de cuencas y recursos hídricos."
            },
            {
                "name": "ANA - Visor por cuencas",
                "type": "OFICIAL - MAPA HIDROLÓGICO",
                "url": "https://snirh.ana.gob.pe/observatoriosnirh/Index.aspx",
                "description": "Consulta de unidades hidrográficas y capas temáticas."
            },
            {
                "name": "Open-Meteo - Pronóstico",
                "type": "MODELO METEOROLÓGICO",
                "url": "https://open-meteo.com/",
                "description": "Condiciones actuales estimadas y pronósticos."
            },
            {
                "name": "Open-Meteo - Archivo histórico",
                "type": "MODELO HISTÓRICO",
                "url": "https://archive-api.open-meteo.com/v1/archive",
                "description": "Datos históricos meteorológicos de modelos."
            }
        ]
    }



risk_cache = {"timestamp": 0, "data": None}


@app.get("/api/riesgo/nacional")
async def riesgo_nacional():
    """
    Índice meteorológico orientativo basado en precipitación prevista.
    No representa una predicción hidrológica ni una alerta oficial.
    """
    if risk_cache["data"] and time.time() - risk_cache["timestamp"] < 600:
        return risk_cache["data"]

    names = list(DEPARTMENTS.keys())
    latitudes = ",".join(str(DEPARTMENTS[n][0]) for n in names)
    longitudes = ",".join(str(DEPARTMENTS[n][1]) for n in names)

    params = {
        "latitude": latitudes,
        "longitude": longitudes,
        "current": "precipitation",
        "hourly": "precipitation,precipitation_probability",
        "forecast_days": 1,
        "timezone": "auto"
    }

    try:
        async with httpx.AsyncClient(timeout=40) as client:
            response = await client.get(
                "https://api.open-meteo.com/v1/forecast",
                params=params
            )
            response.raise_for_status()
            raw = response.json()

        items = raw if isinstance(raw, list) else [raw]

        if len(items) != len(names):
            raise HTTPException(
                status_code=502,
                detail="El proveedor no devolvió datos para los 25 departamentos."
            )

        results = []
        totals = {"BAJO": 0, "MEDIO": 0, "ALTO": 0, "CRÍTICO": 0, "SIN DATOS": 0}

        for name, item in zip(names, items):
            lat, lon, capital = DEPARTMENTS[name]
            current = item.get("current") or {}
            hourly = item.get("hourly") or {}

            times = hourly.get("time") or []
            rain_values = hourly.get("precipitation") or []
            probabilities = hourly.get("precipitation_probability") or []

            current_time = current.get("time", "")
            current_hour = current_time[:13] if len(current_time) >= 13 else ""

            start = next(
                (i for i, value in enumerate(times)
                 if isinstance(value, str) and value[:13] == current_hour),
                None
            )

            if start is None or not rain_values:
                rain_6h = None
                probability_max = None
                score = None
                level = "SIN DATOS"
            else:
                next_rain = rain_values[start:start + 6]
                next_prob = probabilities[start:start + 6]

                valid_rain = [v for v in next_rain if isinstance(v, (int, float))]
                valid_prob = [v for v in next_prob if isinstance(v, (int, float))]

                if not valid_rain:
                    rain_6h = None
                    probability_max = max(valid_prob) if valid_prob else None
                    score = None
                    level = "SIN DATOS"
                else:
                    rain_6h = round(sum(valid_rain), 1)
                    probability_max = max(valid_prob) if valid_prob else 0

                    # Índice heurístico: lluvia acumulada (85 puntos)
                    # y probabilidad máxima de precipitación (15 puntos).
                    score = min(
                        100,
                        round((rain_6h / 40) * 85 + (probability_max / 100) * 15)
                    )

                    if score >= 75:
                        level = "CRÍTICO"
                    elif score >= 50:
                        level = "ALTO"
                    elif score >= 25:
                        level = "MEDIO"
                    else:
                        level = "BAJO"

            totals[level] += 1

            results.append({
                "department": name,
                "capital": capital,
                "latitude": lat,
                "longitude": lon,
                "precipitation_next_6h_mm": rain_6h,
                "maximum_rain_probability_percent": probability_max,
                "meteorological_index": score,
                "risk_level": level,
                "reference_time": current_time or None
            })

        results.sort(
            key=lambda x: (
                -1 if x["meteorological_index"] is None
                else x["meteorological_index"]
            ),
            reverse=True
        )

        result = {
            "source": "Open-Meteo",
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "count": len(results),
            "risk_summary": totals,
            "departments": results,
            "method": {
                "name": "Índice meteorológico orientativo",
                "rain_weight_percent": 85,
                "probability_weight_percent": 15,
                "forecast_window_hours": 6
            },
            "notice": (
                "Este índice es orientativo y utiliza precipitación prevista "
                "y probabilidad de lluvia. No mide niveles de ríos, no calcula "
                "inundaciones y no constituye una alerta oficial."
            )
        }

        risk_cache["timestamp"] = time.time()
        risk_cache["data"] = result
        return result

    except httpx.HTTPError as error:
        raise HTTPException(
            status_code=502,
            detail=f"No se pudo consultar el pronóstico: {str(error)}"
        )


@app.get("/api/alertas")
async def alertas_nacionales():
    data = await riesgo_nacional()
    alerts = [
        item for item in data["departments"]
        if item["risk_level"] in ("ALTO", "CRÍTICO")
    ]
    return {
        "source": data["source"],
        "updated_at": data["updated_at"],
        "count": len(alerts),
        "alerts": alerts,
        "notice": data["notice"]
    }

@app.get("/api/simulacion")
def simulacion(
    departamento: str = "Lima",
    lluvia_mm: float = 40,
    nivel_rio_m: float = 1.5,
    duracion_horas: int = 6
):
    """
    Simulación educativa configurable.
    Ninguna variable representa una medición real de un río.
    """
    if departamento not in DEPARTMENTS:
        raise HTTPException(status_code=400, detail="Departamento no válido.")

    if not 0 <= lluvia_mm <= 300:
        raise HTTPException(status_code=400, detail="La lluvia debe estar entre 0 y 300 mm.")

    if not 0 <= nivel_rio_m <= 15:
        raise HTTPException(status_code=400, detail="El nivel de agua simulado debe estar entre 0 y 15 m.")

    if not 1 <= duracion_horas <= 72:
        raise HTTPException(status_code=400, detail="La duración debe estar entre 1 y 72 horas.")

    capital = DEPARTMENTS[departamento][2]

    rain_score = min(55, (lluvia_mm / 150) * 55)
    water_score = min(30, (nivel_rio_m / 8) * 30)
    duration_score = min(15, (duracion_horas / 72) * 15)

    score = round(min(100, rain_score + water_score + duration_score))

    if score >= 75:
        risk = "CRÍTICO"
    elif score >= 50:
        risk = "ALTO"
    elif score >= 25:
        risk = "MEDIO"
    else:
        risk = "BAJO"

    return {
        "departamento": departamento,
        "capital": capital,
        "nivel_rio": round(nivel_rio_m, 2),
        "lluvia": round(lluvia_mm, 1),
        "duracion_horas": duracion_horas,
        "indice": score,
        "riesgo": risk,
        "actualizado": datetime.now().astimezone().strftime("%d/%m/%Y %H:%M:%S"),
        "tipo": "SIMULACIÓN CONFIGURABLE",
        "componentes": {
            "lluvia": round(rain_score, 1),
            "nivel_agua": round(water_score, 1),
            "duracion": round(duration_score, 1)
        },
        "notice": (
            "Escenario educativo. El nivel de agua, la lluvia y el índice "
            "son valores introducidos para simular; no son mediciones reales "
            "ni una predicción hidráulica."
        )
    }
