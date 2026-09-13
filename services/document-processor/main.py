"""
Botify Document Processor Microservice
Powered by Microsoft MarkItDown

Provides an HTTP API for converting documents (PDF, DOCX, XLSX, PPTX, CSV, images)
into clean, structured Markdown for LLMs and RAG knowledge systems.
"""

import os
import tempfile
import shutil
from typing import Optional
from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from markitdown import MarkItDown

app = FastAPI(
    title="Botify Document Processor",
    description="Document conversion microservice using Microsoft MarkItDown",
    version="1.0.0"
)

# Enable CORS for local dev and web services
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize MarkItDown converter instance
md_converter = MarkItDown()


class ConversionResponse(BaseModel):
    success: bool
    filename: Optional[str] = None
    markdown: str = ""
    title: Optional[str] = None
    error: Optional[str] = None


@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": "botify-document-processor",
        "version": "1.0.0"
    }


@app.post("/convert", response_model=ConversionResponse)
async def convert_file(file: UploadFile = File(...)):
    """
    Accepts an uploaded file (PDF, DOCX, XLSX, PPTX, CSV, HTML, Image)
    and returns parsed Markdown with preserved table and heading structure.
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="Missing filename")

    suffix = os.path.splitext(file.filename)[1].lower()
    
    # Write to a temporary file so MarkItDown can inspect file headers and structure
    temp_file = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            temp_file = tmp.name
            shutil.copyfileobj(file.file, tmp)

        # Convert using MarkItDown
        result = md_converter.convert(temp_file)
        markdown_text = result.text_content or ""
        title = result.title or file.filename

        return ConversionResponse(
            success=True,
            filename=file.filename,
            markdown=markdown_text,
            title=title
        )

    except Exception as exc:
        return ConversionResponse(
            success=False,
            filename=file.filename,
            markdown="",
            error=str(exc)
        )
    finally:
        if temp_file and os.path.exists(temp_file):
            try:
                os.remove(temp_file)
            except Exception:
                pass


@app.post("/convert-url", response_model=ConversionResponse)
async def convert_url(url: str = Form(...)):
    """
    Accepts a URL (webpage or YouTube) and returns structured Markdown.
    """
    try:
        result = md_converter.convert(url.strip())
        return ConversionResponse(
            success=True,
            filename=url,
            markdown=result.text_content or "",
            title=result.title or url
        )
    except Exception as exc:
        return ConversionResponse(
            success=False,
            filename=url,
            markdown="",
            error=str(exc)
        )


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 3001))
    uvicorn.run("main:app", host="127.0.0.1", port=port, reload=True)
