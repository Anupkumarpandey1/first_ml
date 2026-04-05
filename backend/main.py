import uuid
import json
import traceback

from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import Optional
import os

from agent import (
    get_session,
    extract_report_with_vision,
    analyze_report_with_gemini,
    run_agent,
    load_patient_risk,
)

app = FastAPI(title="Healthcare Diagnostic Assistant")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

if os.path.exists("correlation.png"):
    app.mount("/static", StaticFiles(directory="."), name="static")


# ─── Models ──────────────────────────────────────────────────────────────────
class PatientInfo(BaseModel):
    name: str
    age: int
    gender: str
    height: float  # cm
    weight: float  # kg


class ChatRequest(BaseModel):
    session_id: str
    message: str


class PatientData(BaseModel):
    Age: float
    Blood_Pressure: float
    Cholesterol: float
    BMI: float
    Glucose: float


# ─── Patient Registration ───────────────────────────────────────────────────
@app.post("/patient/register")
def register_patient(info: PatientInfo):
    session_id = str(uuid.uuid4())
    session = get_session(session_id)

    bmi = round(info.weight / ((info.height / 100) ** 2), 1)

    session["patient_info"] = {
        "name": info.name,
        "age": info.age,
        "gender": info.gender,
        "height": info.height,
        "weight": info.weight,
        "bmi": bmi,
    }

    return {
        "status": "success",
        "session_id": session_id,
        "bmi": bmi,
        "patient_info": session["patient_info"],
    }


# ─── Report Upload ──────────────────────────────────────────────────────────
@app.post("/report/upload")
async def upload_report(session_id: str = Form(...), file: UploadFile = File(...)):
    session = get_session(session_id)
    if not session["patient_info"]:
        raise HTTPException(status_code=400, detail="Register patient first.")

    try:
        file_bytes = await file.read()
        extracted_text = extract_report_with_vision(file_bytes, file.filename)
        
        if "NOT_A_HEALTH_REPORT" in extracted_text:
            raise HTTPException(status_code=400, detail="This doesn't look like a medical lab report! Please upload a valid health report (blood test, CBC, etc).")

        session["report_text"] = extracted_text

        # Try to parse as JSON
        clean = extracted_text.strip()
        if clean.startswith("```"):
            clean = clean.split("\n", 1)[1]
            clean = clean.rsplit("```", 1)[0]

        try:
            report_data = json.loads(clean)
        except json.JSONDecodeError:
            report_data = {"raw_text": extracted_text}

        return {
            "status": "success",
            "extracted_data": report_data,
            "message": f"Successfully extracted {len(report_data)} parameters from the report.",
        }
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error processing report: {str(e)}")


# ─── Report Analysis ────────────────────────────────────────────────────────
@app.post("/report/analyze")
def analyze_report(session_id: str = Form(...)):
    session = get_session(session_id)
    if not session["report_text"]:
        raise HTTPException(status_code=400, detail="Upload a report first.")

    try:
        raw = session["report_text"].strip()
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[1]
            raw = raw.rsplit("```", 1)[0]

        try:
            report_data = json.loads(raw)
        except json.JSONDecodeError:
            report_data = {"raw_text": raw}

        analysis = analyze_report_with_gemini(session["patient_info"], report_data)
        session["report_analysis"] = analysis

        return {"status": "success", "analysis": analysis}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error analyzing report: {str(e)}")


# ─── Chat ────────────────────────────────────────────────────────────────────
@app.post("/chat")
def chat_with_agent(req: ChatRequest):
    try:
        response = run_agent(req.session_id, req.message)
        return {"response": response}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# ─── Legacy Predict (kept for backward compatibility) ────────────────────────
@app.post("/patient/predict")
def predict_risk(data: PatientData):
    patient_dict = data.model_dump()
    result = load_patient_risk(patient_dict)
    return {
        "status": "success",
        "analysis": result,
        "correlation_plot": "/static/correlation.png",
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
