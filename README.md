# TaskPulse AI - Dual Audio Meeting Recorder & Action Task Extractor (Python/FastAPI)

TaskPulse AI is an intelligent meeting session recorder, speech-to-text transcriber, executive summary generator, and Kanban action task extractor powered by Python, FastAPI, WASAPI Dual Audio capture, and Google Gemini AI.

## 📦 How to Install Python Packages & Run

### 1. Clone & Setup Virtual Environment
```bash
git clone https://github.com/projectdeveloperyogesh/tm-python.git
cd tm-python

python -m venv .venv
```

### 2. Activate Virtual Environment & Install Packages
- **Windows**: `.venv\Scripts\activate`
- **macOS/Linux**: `source .venv/bin/activate`

```bash
pip install -r requirements.txt
```

### 3. Start Server
```bash
python main.py
```
Open [http://127.0.0.1:8000](http://127.0.0.1:8000) in your browser.
See [STEPS_TO_RUN.md](STEPS_TO_RUN.md) for full guide.
