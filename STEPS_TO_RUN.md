# 🐍 TaskPulse AI (Python/FastAPI) - Steps to Run on Any System

Follow these step-by-step instructions to set up and run the Python/FastAPI version of **TaskPulse AI** on any Windows/Mac/Linux computer.

---

## 📋 Prerequisites
- **Python 3.10+** installed on your system ([python.org/downloads](https://www.python.org/downloads/)).
- **Git** installed on your system.

---

## 🚀 Step-by-Step Setup Guide

### 1️⃣ Clone the Repository
```bash
git clone https://github.com/projectdeveloperyogesh/tm-python.git
cd tm-python
```

### 2️⃣ Create and Activate a Virtual Environment
- **Windows (Command Prompt / PowerShell)**:
  ```bash
  python -m venv .venv
  .venv\Scripts\activate
  ```
- **macOS / Linux**:
  ```bash
  python3 -m venv .venv
  source .venv/bin/activate
  ```

### 3️⃣ Install Python Dependencies
```bash
pip install -r requirements.txt
```

### 4️⃣ Set Your Gemini API Key (Optional for AI Notes)
Create a `.env` file in the root directory OR input your Gemini API Key in the UI Settings tab:
```env
GEMINI_API_KEY=your_google_gemini_api_key_here
PORT=8000
```

### 5️⃣ Run the Application
```bash
python main.py
```

---

## 🌐 Accessing the Application
Open your web browser and navigate to:
👉 **[http://127.0.0.1:8000](http://127.0.0.1:8000)**

---

## 🔧 Troubleshooting on New Systems:
- **No Soundcards Listed**: Ensure your microphone is plugged in and granted privacy permissions in Windows Settings (*Settings > Privacy & Security > Microphone > Allow desktop apps to access your microphone*).
- **Speech Recognition Error**: Ensure you have an active internet connection for Google Speech Recognition API.
