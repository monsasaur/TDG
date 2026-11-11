from fastapi import FastAPI, HTTPException
from app.schemas import PredictRequest
from app.predict import run_model, MODEL_VERSION, N_FEATURES, FALL_THRESHOLD

app = FastAPI(title="Fall Detection ML Service")

@app.get("/health")
def health():
    return {"status": "ok", "model_version": MODEL_VERSION, "n_features": N_FEATURES, "threshold": FALL_THRESHOLD}

@app.post("/predict")
async def predict(req: PredictRequest):
    try:
        return run_model(req.features)
    except ValueError as e:          # จำนวน feature ไม่ตรงกับโมเดลที่โหลด
        raise HTTPException(status_code=400, detail=str(e))

