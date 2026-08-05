# 🐍 TaskPulse AI (Python/FastAPI) - Steps to Run & Install Python Packages

Follow these step-by-step instructions to set up Python packages and run **TaskPulse AI** on any computer.

---

## 📋 Prerequisites
- **Python 3.10+** ([Download Python](https://www.python.org/downloads/))
- **Git** ([Download Git](https://git-scm.com/))

---

## 📦 How to Install Python Packages

### 1️⃣ Clone the Repository
```bash
git clone https://github.com/projectdeveloperyogesh/tm-python.git
cd tm-python
```

### 2️⃣ Create a Virtual Environment
- **Windows (Command Prompt / PowerShell)**:
  ```cmd
  python -m venv .venv
  ```
- **macOS / Linux**:
  ```bash
  python3 -m venv .venv
  ```

### 3️⃣ Activate the Virtual Environment
- **Windows Command Prompt**:
  ```cmd
  .venv\Scripts\activate.bat
  ```
- **Windows PowerShell**:
  ```powershell
  .venv\Scripts\Activate.ps1
  ```
- **macOS / Linux**:
  ```bash
  source .venv/bin/activate
  ```

### 4️⃣ Install Required Python Packages
```bash
python -m pip install --upgrade pip
pip install -r requirements.txt
```

---

## 🚀 Running the Python Application

### Start the FastAPI Server
```bash
python main.py
```

### Open in Browser
Open your web browser and navigate to:
👉 **[http://127.0.0.1:8000](http://127.0.0.1:8000)**

---

## 📦 Included Python Packages (`requirements.txt`)
- `fastapi` - High-performance Web API framework
- `uvicorn` - ASGI Web Server
- `pyaudiowpatch` - Windows WASAPI System Audio Loopback recorder
- `sounddevice` - Real-time audio stream processor
- `numpy` & `scipy` - Audio PCM signal interpolation
- `SpeechRecognition` - Offline / Online Speech-to-Text conversion
- `python-multipart` & `jinja2` - Form uploads & HTML UI rendering
- `google-generativeai` - Google Gemini 1.5 Flash AI SDK
