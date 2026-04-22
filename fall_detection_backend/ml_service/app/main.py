from fastapi import FastAPI
from app.schemas import PredictRequest
from app.predict import run_model

app = FastAPI(title="Fall Detection ML Service")

@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/predict")
async def predict(req: PredictRequest):
    return run_model(req.features)

