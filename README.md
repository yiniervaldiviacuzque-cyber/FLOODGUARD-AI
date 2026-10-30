# FLOODGUARD AI

Prototipo demostrativo de monitoreo y evaluación de riesgo de inundaciones.

## Funciones
- Dashboard web.
- Indicadores ambientales simulados.
- Evaluación demostrativa del riesgo.
- Gráfico del nivel del río.
- Mapa conceptual de monitoreo.
- API con FastAPI.

## Ejecutar

```bash
source .venv/bin/activate
python -m pip install -r requirements.txt
./run.sh
```

Abrir: http://127.0.0.1:8000

## API
- GET /api/health
- GET /api/dashboard

**Aviso:** los datos son simulados. No son mediciones reales ni alertas oficiales.
