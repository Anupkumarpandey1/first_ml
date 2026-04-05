import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression
import seaborn as sns
import matplotlib.pyplot as plt
import joblib
import os

def generate_and_train_model():
    print("Generating synthetic patient data...")
    np.random.seed(42)
    n_samples = 1000
    
    # Synthetic Features
    age = np.random.normal(55, 15, n_samples)
    blood_pressure = np.random.normal(120, 20, n_samples)
    cholesterol = np.random.normal(200, 40, n_samples)
    bmi = np.random.normal(28, 5, n_samples)
    glucose = np.random.normal(100, 30, n_samples)
    
    # Intentionally introducing some "missing" values to handle them
    df = pd.DataFrame({
        'Age': age,
        'Blood_Pressure': blood_pressure,
        'Cholesterol': cholesterol,
        'BMI': bmi,
        'Glucose': glucose
    })
    
    # Introduce NaNs randomly
    for col in df.columns:
        df.loc[df.sample(frac=0.05).index, col] = np.nan
        
    print("Handling missing values...")
    df.fillna(df.median(), inplace=True)
    
    # Create target (Risk based on thresholding underlying risk score)
    risk_score = (
        (df['Age'] > 60).astype(int) * 1.5 +
        (df['Blood_Pressure'] > 140).astype(int) * 2.0 +
        (df['Cholesterol'] > 240).astype(int) * 1.8 +
        (df['BMI'] > 30).astype(int) * 1.2 +
        (df['Glucose'] > 125).astype(int) * 2.5
    )
    # Binary classification target
    df['Diabetes_Risk'] = (risk_score > 3.0).astype(int)
    
    print("Plotting correlation matrix...")
    plt.figure(figsize=(10, 8))
    corr = df.corr()
    sns.heatmap(corr, annot=True, cmap='coolwarm', fmt=".2f")
    plt.title("Patient Health Metrics Correlation Matrix")
    plt.tight_layout()
    plt.savefig("correlation.png")
    plt.close()
    
    print("Training Logistic Regression model...")
    X = df.drop('Diabetes_Risk', axis=1)
    y = df['Diabetes_Risk']
    
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)
    
    model = LogisticRegression()
    model.fit(X_train_scaled, y_train)
    
    acc = model.score(X_test_scaled, y_test)
    print(f"Model trained with accuracy: {acc:.2f}")
    
    print("Saving model and scaler...")
    joblib.dump(model, "risk_model.pkl")
    joblib.dump(scaler, "scaler.pkl")
    print("Done. Files saved: risk_model.pkl, scaler.pkl, correlation.png")

if __name__ == "__main__":
    generate_and_train_model()
