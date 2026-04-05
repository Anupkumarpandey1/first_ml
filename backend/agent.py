import os
import json
import base64
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.tools import tool
from langgraph.prebuilt import create_react_agent
import joblib
import pandas as pd
from rag_pipeline import get_retriever
from google import genai

os.environ["GOOGLE_API_KEY"] = "REDACTED" # Get one from https://aistudio.google.com/app/apikey

# ─── Session Store ───────────────────────────────────────────────────────────
_sessions = {}

def get_session(session_id: str) -> dict:
    if session_id not in _sessions:
        _sessions[session_id] = {
            "patient_info": {},
            "report_text": "",
            "report_analysis": {},
            "chat_history": [],
        }
    return _sessions[session_id]


# ─── Gemini Vision: Extract Report ──────────────────────────────────────────
def extract_report_with_vision(file_bytes: bytes, filename: str) -> str:
    """Use Gemini Vision to read a health report image, or pypdf for PDF, and extract all values."""
    client = genai.Client(api_key=os.environ["GOOGLE_API_KEY"])

    parts = []
    
    if filename.lower().endswith(".pdf"):
        import io
        from pypdf import PdfReader
        pdf = PdfReader(io.BytesIO(file_bytes))
        text = ""
        for page in pdf.pages:
            text += page.extract_text() + "\n"
        parts.append({"text": f"Here is the text extracted from the uploaded PDF medical report:\n\n{text}"})
    else:
        mime = "image/png"
        if filename.lower().endswith(".jpg") or filename.lower().endswith(".jpeg"):
            mime = "image/jpeg"
        elif filename.lower().endswith(".webp"):
            mime = "image/webp"

        b64 = base64.b64encode(file_bytes).decode("utf-8")
        parts.append({"inline_data": {"mime_type": mime, "data": b64}})

    parts.append({
        "text": (
            "You are a medical lab report reader. First, check if this is a health/medical/blood report. If it is NOT a health report (e.g. a random photo, receipt, or unrelated document), you MUST return the exact string 'NOT_A_HEALTH_REPORT' and nothing else.\n"
            "If it is a health report, extract ALL test parameters. Return a JSON object where each key is the test name and the value is an object with:\n"
            '- "value": the numeric or text value\n'
            '- "unit": the unit of measurement\n'
            '- "reference_range": the normal reference range shown on the report\n'
            '- "status": "normal", "high", or "low" based on the reference range\n'
            "Extract EVERY single parameter you can find. Be thorough.\n"
            "Return ONLY the JSON, no markdown fences, no explanation."
        )
    })

    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=[{"role": "user", "parts": parts}],
    )
    return response.text


# ─── Gemini: Analyze Report ─────────────────────────────────────────────────
def analyze_report_with_gemini(patient_info: dict, report_data: dict) -> dict:
    """Generate a structured, patient-friendly health report analysis."""
    client = genai.Client(api_key=os.environ["GOOGLE_API_KEY"])

    prompt = f"""You are a compassionate, expert doctor explaining a patient's health report.

PATIENT PROFILE:
- Name: {patient_info.get('name', 'Patient')}
- Age: {patient_info.get('age', 'N/A')} years
- Gender: {patient_info.get('gender', 'N/A')}
- Height: {patient_info.get('height', 'N/A')} cm
- Weight: {patient_info.get('weight', 'N/A')} kg
- BMI: {patient_info.get('bmi', 'N/A')}

LAB REPORT DATA:
{json.dumps(report_data, indent=2)}

Analyze the report and return a JSON object with these exact keys:

{{
  "summary": "A 2-3 sentence overall summary of the patient's health status in very simple, friendly language.",
  "good_findings": [
    {{
      "parameter": "Test Name",
      "value": "value with unit",
      "explanation": "What this means in very simple language, as if you are explaining to a person with no medical knowledge. 1-2 sentences."
    }}
  ],
  "concerning_findings": [
    {{
      "parameter": "Test Name",
      "value": "value with unit",
      "severity": "mild" or "moderate" or "serious",
      "explanation": "What this means in very simple, non-scary language. What it could indicate. 2-3 sentences.",
      "what_to_do": "Simple actionable advice in 1 sentence."
    }}
  ],
  "disease_risks": [
    {{
      "disease": "Disease Name",
      "risk_level": "low" or "moderate" or "high",
      "explanation": "Why this risk exists based on the report, in simple words. 1-2 sentences."
    }}
  ],
  "follow_up_tests": [
    {{
      "test_name": "Test Name",
      "reason": "Why this test is recommended based on the findings. 1 sentence.",
      "urgency": "routine" or "soon" or "urgent"
    }}
  ],
  "lifestyle_tips": [
    "Practical, personalized tips based on the report findings. 1 sentence each."
  ]
}}

IMPORTANT:
- Explain everything in VERY SIMPLE language, no medical jargon without explanation.
- Be compassionate and encouraging, not scary.
- If the report is mostly normal, emphasize the good findings.
- Be specific to THIS patient's values, don't give generic advice.
- Return ONLY the JSON, no markdown fences."""

    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=prompt,
    )

    text = response.text.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1]
        text = text.rsplit("```", 1)[0]

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return {
            "summary": text,
            "good_findings": [],
            "concerning_findings": [],
            "disease_risks": [],
            "follow_up_tests": [],
            "lifestyle_tips": [],
        }


# ─── ML Risk Prediction (kept for backward compatibility) ───────────────────
def load_patient_risk(medical_data: dict) -> str:
    try:
        model = joblib.load("risk_model.pkl")
        scaler = joblib.load("scaler.pkl")
        df = pd.DataFrame([medical_data])
        scaled_features = scaler.transform(df)
        prediction = model.predict(scaled_features)[0]
        proba = model.predict_proba(scaled_features)[0]
        risk_label = "HIGH RISK for Diabetes" if prediction == 1 else "LOW RISK for Diabetes"
        confidence = max(proba) * 100
        details = (
            f"Patient Stats - Age: {medical_data['Age']}, "
            f"BP: {medical_data['Blood_Pressure']}, "
            f"Cholesterol: {medical_data['Cholesterol']}, "
            f"BMI: {medical_data['BMI']}, "
            f"Glucose: {medical_data['Glucose']}. "
        )
        return details + f"Prediction: {risk_label} (Confidence: {confidence:.1f}%)."
    except Exception as e:
        return f"Error retrieving risk: {str(e)}"


# ─── LangGraph Agent Tools ──────────────────────────────────────────────────
_active_session_id = None

def set_active_session(session_id: str):
    global _active_session_id
    _active_session_id = session_id

@tool
def patient_profile_retrieval(query: str) -> str:
    """Use this tool to retrieve the current patient's full profile including their name, age, gender, height, weight, BMI, and any uploaded health report data. Use this whenever the user asks about the patient's information or when you need context about who you are treating."""
    session = get_session(_active_session_id)
    info = session.get("patient_info", {})
    report = session.get("report_text", "")
    analysis = session.get("report_analysis", {})

    parts = []
    if info:
        parts.append(f"Patient Profile: {json.dumps(info, indent=2)}")
    if report:
        parts.append(f"Raw Lab Report Data: {report[:3000]}")
    if analysis:
        parts.append(f"Report Analysis: {json.dumps(analysis, indent=2)}")
    return "\n\n".join(parts) if parts else "No patient data available yet."

@tool
def medical_literature_search(query: str) -> str:
    """Use this tool when you need to search medical guidelines, clinical treatments, drug recommendations, or research literature for a specific condition, symptom, or risk profile. Input should describe the medical topic to search for."""
    retriever = get_retriever()
    docs = retriever.invoke(query)
    if not docs:
        return "No relevant medical literature found for this query."
    return "\n\n".join([d.page_content for d in docs])


# ─── Agent Executor ──────────────────────────────────────────────────────────
_agent_cache = {}

def get_agent():
    if "executor" not in _agent_cache:
        llm = ChatGoogleGenerativeAI(
            model="gemini-2.5-flash",
            temperature=0.3,
        )
        tools = [patient_profile_retrieval, medical_literature_search]
        system_message = (
            "You are Dr. HealthAI, a compassionate and knowledgeable medical AI assistant. "
            "You have access to the patient's full health profile, uploaded lab reports, and medical literature. "
            "ALWAYS start by retrieving the patient's profile to understand their context before answering. "
            "When answering:\n"
            "- ALWAYS use proper Markdown formatting. Use ### for headers and use bullet points (*) generously.\n"
            "- ALWAYS put TWO newlines (\\n\\n) before and after any headers or lists so they are spaced properly.\n"
            "- Explain things in very simple, easy-to-understand language\n"
            "- Be warm, compassionate, and encouraging\n"
            "- Reference specific values from the patient's report when relevant\n"
            "- Provide actionable advice\n"
            "- If something is concerning, explain it gently without being scary\n"
            "- Always suggest consulting a real doctor for serious concerns\n"
        )
        _agent_cache["executor"] = create_react_agent(llm, tools, prompt=system_message)
    return _agent_cache["executor"]


def run_agent(session_id: str, message: str) -> str:
    try:
        set_active_session(session_id)
        agent = get_agent()

        session = get_session(session_id)
        history = session.get("chat_history", [])

        messages = []
        for msg in history[-10:]:
            messages.append((msg["role"], msg["content"]))
        messages.append(("human", message))

        result = agent.invoke({"messages": messages})
        resp_messages = result.get("messages", [])
        if resp_messages:
            last = resp_messages[-1]
            content = getattr(last, "content", None)
            if content is not None:
                if isinstance(content, list):
                    parts = []
                    for block in content:
                        if isinstance(block, str):
                            parts.append(block)
                        elif isinstance(block, dict) and "text" in block:
                            parts.append(block["text"])
                        else:
                            parts.append(str(block))
                    response_text = "\n".join(parts)
                else:
                    response_text = str(content)
            else:
                response_text = str(last)
        else:
            response_text = "I'm sorry, I couldn't generate a response. Please try again."

        # Save to history
        session["chat_history"].append({"role": "human", "content": message})
        session["chat_history"].append({"role": "ai", "content": response_text})

        return response_text
    except Exception as e:
        return f"I'm sorry, I encountered an error: {str(e)}"
