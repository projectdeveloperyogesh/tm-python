# TaskPulse AI - Dual Audio Meeting Recorder & Action Task Extractor (Python/FastAPI)

TaskPulse AI is an intelligent meeting session recorder, speech-to-text transcriber, executive summary generator, and Kanban action task extractor powered by Python, FastAPI, WASAPI Dual Audio capture, and Google Gemini AI.

## Features
- **WASAPI Desktop Soundcard Dual Audio**: Capture both Microphone and System Speaker Audio (Zoom, Teams, Meet, YouTube).
- **Multi-language Support**: Summaries & Action Items in English, Hindi (Devanagari), Hinglish, Spanish, French, and German.
- **Kanban Task Board**: Extract action items automatically with Priority, Assignee, and Due Date.
- **REST APIs**: FastAPI endpoints for meetings, tasks, settings, and media uploads.

## Running Locally
```bash
# 1. Install dependencies
pip install -r requirements.txt

# 2. Run FastAPI server
python main.py
```
Open [http://127.0.0.1:8000](http://127.0.0.1:8000) in your browser.
