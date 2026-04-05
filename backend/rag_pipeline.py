import os
from langchain_community.document_loaders import TextLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import FAISS
from langchain_community.embeddings import HuggingFaceEmbeddings

FAISS_DB_DIR = "faiss_index"

def build_rag_index():
    print("Setting up sample medical literature text...")
    sample_text = """
    MEDICAL GUIDELINES & LITERATURE
    
    Type 2 Diabetes Treatments:
    First-line therapy for Type 2 Diabetes is generally Metformin. For patients with high cardiovascular risk, SGLT2 inhibitors (e.g., Empagliflozin) or GLP-1 receptor agonists (e.g., Liraglutide) are recommended. 
    Lifestyle modifications including weight loss (targeting BMI < 25), dietary changes, and regular exercise (150 minutes/week) are universally advised.
    
    Hypertension Management:
    For patients with blood pressure over 140/90, first-line antihypertensive medications include ACE inhibitors (e.g., Lisinopril), ARBs (e.g., Losartan), Calcium Channel Blockers (e.g., Amlodipine), or Thiazide diuretics.
    
    Hyperlipidemia:
    Statins (e.g., Atorvastatin, Rosuvastatin) are indicated for patients with LDL cholesterol levels notably over 190 mg/dL, or those with significant cardiovascular risk factors. 
    
    General Risk Profiling:
    A combination of elevated Glucose, BMI > 30, and Blood Pressure > 140 points heavily towards Metabolic Syndrome and preemptive risk for severe diabetic complications.
    """
    
    with open("sample_medical_guidelines.txt", "w") as f:
        f.write(sample_text)
        
    print("Loading text and splitting...")
    loader = TextLoader("sample_medical_guidelines.txt")
    docs = loader.load()
    
    text_splitter = RecursiveCharacterTextSplitter(chunk_size=300, chunk_overlap=50)
    splits = text_splitter.split_documents(docs)
    
    print("Initializing embedding model (Sentence Transformers)...")
    # Using a lightweight local embedding model
    embedding_model = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")
    
    print("Building FAISS vector store...")
    vectorstore = FAISS.from_documents(splits, embedding_model)
    
    print("Saving FAISS index locally...")
    vectorstore.save_local(FAISS_DB_DIR)
    print("Done. Index saved to 'faiss_index' directory.")

def get_retriever():
    embedding_model = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")
    vectorstore = FAISS.load_local(FAISS_DB_DIR, embedding_model, allow_dangerous_deserialization=True)
    return vectorstore.as_retriever(search_kwargs={"k": 2})

if __name__ == "__main__":
    build_rag_index()
