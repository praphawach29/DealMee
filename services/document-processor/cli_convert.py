import sys
import json
import os
import warnings

# Ensure UTF-8 output on Windows console
if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

# Suppress runtime warnings from media/audio libraries so stdout stays clean JSON
warnings.filterwarnings("ignore")

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"success": False, "error": "No file path provided", "markdown": ""}))
        sys.exit(1)

    filepath = sys.argv[1]
    if not os.path.exists(filepath):
        print(json.dumps({"success": False, "error": f"File not found: {filepath}", "markdown": ""}))
        sys.exit(1)

    try:
        from markitdown import MarkItDown
        md = MarkItDown()
        result = md.convert(filepath)
        output = {
            "success": True,
            "filename": os.path.basename(filepath),
            "markdown": result.text_content or "",
            "title": result.title or os.path.basename(filepath)
        }
    except Exception as exc:
        output = {
            "success": False,
            "filename": os.path.basename(filepath),
            "error": str(exc),
            "markdown": ""
        }

    print(json.dumps(output, ensure_ascii=False))

if __name__ == "__main__":
    main()
