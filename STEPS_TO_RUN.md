# 🐍 TaskPulse AI (Python/FastAPI) - Steps to Run

Follow these step-by-step instructions to set up and run the Python/FastAPI version of **TaskPulse AI**.

---

## 📋 Prerequisites
- **Python 3.10+** installed on your system.
- **Git** installed on your system.
- **FFmpeg** installed (optional, for non-WAV media conversion).

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

### 4️⃣ Configure Environment Variables (Optional for Gemini AI)
Create a `.env` file in the root directory or set your Gemini API key inside the UI Settings:
```env
GEMINI_API_KEY=your_google_gemini_api_key_here
PORT=8000
```

### 5️⃣ Run the Python FastAPI Server
```bash
python main.py
```

---

## 🌐 Accessing the Application
Open your web browser and navigate to:
👉 **[http://127.0.0.1:8000](http://127.0.0.1:8000)**

---

## 🎯 Main Application Features
1. **💻 Desktop Dual Audio Mode**: Record both your Microphone and System Speaker Audio (Zoom, Teams, Meet, YouTube) using Windows WASAPI soundcards.
2. **🌐 Web Browser Mode**: Record directly using HTML5 WebAudio.
3. **📁 Media File Uploader**: Upload `.mp3`, `.wav`, `.mp4`, or `.webm` files for transcription and note generation.
4. **📊 Summary & Insights**: Executive summaries, topics discussed, and full timestamped transcripts in English, Hindi, Hinglish, Spanish, French, or German.
5. **📋 Kanban Action Task Board**: Filter action items by status (*To Do*, *In Progress*, *Done*) and priority (*High*, *Medium*, *Low*).
