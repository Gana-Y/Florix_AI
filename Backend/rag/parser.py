"""
Florix AI — Structural Academic Document Parser
Extracts structural elements, preserves page boundaries, and detects academic content types
such as code blocks, mathematical equations, tables, and definitions.
Author: Ganesh (Lead Architect)
"""

import re
import os
from typing import List, Tuple, Optional
from pypdf import PdfReader
from .models import ContentType, ParsedSection


# Regex patterns for academic content classification
_CODE_FENCE_REGEX = re.compile(r"```[\s\S]*?```", re.MULTILINE)
_MATH_BLOCK_REGEX = re.compile(r"(\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\])", re.MULTILINE)
_INLINE_MATH_REGEX = re.compile(r"(\$[^\$\n]+\$|\\\([^\)]+\\\))")
_TABLE_ROW_REGEX = re.compile(r"^\s*\|.*\|\s*$", re.MULTILINE)
_TABLE_SEPARATOR_REGEX = re.compile(r"^\s*\|?\s*:?-+:?\s*\|[\s:?+\|\-]*$", re.MULTILINE)
_HEADING_MD_REGEX = re.compile(r"^(#{1,6})\s+(.+)$", re.MULTILINE)
_HEADING_NUMERIC_REGEX = re.compile(r"^(\d+(\.\d+)*)\s+([A-Z][\w\s]{2,80})$", re.MULTILINE)
_DEFINITION_REGEX = re.compile(r"^([A-Z][A-Za-z0-9\s_\-\(\)]{2,40})\s*(?::|\s*[\u2013\u2014\-]\s*)\s+([A-Z].{15,})$", re.MULTILINE)
_LIST_ITEM_REGEX = re.compile(r"^\s*([\*\-\+]|\d+\.)\s+.+", re.MULTILINE)

# Programming keywords for heuristics
_CODE_KEYWORDS = {
    "def ", "class ", "import ", "from ", "return ", "function ", "const ", "let ",
    "var ", "public class ", "private ", "void ", "int ", "float ", "double ",
    "#include", "cout <<", "std::", "printf(", "scanf(", "SELECT ", "FROM ", "WHERE ",
    "INSERT INTO", "UPDATE ", "DELETE FROM", "JOIN ", "GROUP BY", "ORDER BY",
    "<html>", "</div>", "console.log", "async def", "await "
}

_MATH_KEYWORDS = {
    "\\frac", "\\sum", "\\int", "\\partial", "\\sqrt", "\\alpha", "\\beta", "\\gamma",
    "\\theta", "\\lambda", "\\mu", "\\sigma", "\\infty", "\\approx", "\\neq", "\\leq",
    "\\geq", "\\times", "\\cdot", "\\forall", "\\exists", "\\in", "\\notin", "\\subset"
}


def detect_content_type(text: str) -> ContentType:
    """
    Classifies a text block into its academic content category:
    text, code, table, equation, definition, heading, or list.
    """
    stripped = text.strip()
    if not stripped:
        return ContentType.TEXT

    # 1. Heading check
    lines = [ln.strip() for ln in stripped.splitlines() if ln.strip()]
    if len(lines) == 1 and len(stripped) < 120:
        if _HEADING_MD_REGEX.match(stripped) or _HEADING_NUMERIC_REGEX.match(stripped):
            return ContentType.HEADING
        if stripped.isupper() and len(stripped.split()) <= 10:
            return ContentType.HEADING

    # 2. Code check (fenced or multi-keyword heuristic)
    if "```" in stripped:
        return ContentType.CODE
    code_matches = sum(1 for kw in _CODE_KEYWORDS if kw in stripped)
    if code_matches >= 2 and (";" in stripped or "{" in stripped or ":" in stripped or "()" in stripped):
        return ContentType.CODE

    # 3. Mathematical Equation check
    if _MATH_BLOCK_REGEX.search(stripped):
        return ContentType.EQUATION
    math_matches = sum(1 for kw in _MATH_KEYWORDS if kw in stripped)
    if math_matches >= 2 or (stripped.count("$") >= 2 and any(ch in stripped for ch in "=+-*/^")):
        return ContentType.EQUATION

    # 4. Table check
    table_rows = _TABLE_ROW_REGEX.findall(stripped)
    if len(table_rows) >= 2 or _TABLE_SEPARATOR_REGEX.search(stripped):
        return ContentType.TABLE

    # 5. Definition check
    if len(lines) <= 3 and _DEFINITION_REGEX.search(stripped):
        return ContentType.DEFINITION

    # 6. List check
    list_items = _LIST_ITEM_REGEX.findall(stripped)
    if len(list_items) >= 3 and len(list_items) / max(len(lines), 1) >= 0.5:
        return ContentType.LIST

    return ContentType.TEXT


def parse_pdf_pages(file_path: str) -> List[Tuple[int, str]]:
    """
    Extracts text from a PDF file page by page, preserving page index boundaries.
    Returns: List of (page_number, text) where page_number is 1-indexed.
    """
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"PDF file not found: {file_path}")

    reader = PdfReader(file_path)
    if reader.is_encrypted:
        try:
            reader.decrypt("")
        except Exception:
            raise ValueError("PDF is encrypted and password-protected.")

    pages_text: List[Tuple[int, str]] = []
    for idx, page in enumerate(reader.pages, start=1):
        try:
            extracted = page.extract_text() or ""
            cleaned = extracted.strip()
            if cleaned:
                pages_text.append((idx, cleaned))
            else:
                pages_text.append((idx, f"[Page {idx}: No selectable text detected]"))
        except Exception as e:
            pages_text.append((idx, f"[Page {idx}: Extraction failed: {str(e)}]"))

    return pages_text


def extract_structural_sections(text: str, page_number: Optional[int] = 1) -> List[ParsedSection]:
    """
    Parses a text block into logical sections by identifying headings.
    Ensures headings and their child paragraphs remain structurally linked.
    """
    if not text or not text.strip():
        return []

    lines = text.splitlines()
    sections: List[ParsedSection] = []
    current_title = f"Page {page_number} Section" if page_number is not None else "Document Section"
    current_lines: List[str] = []

    for line in lines:
        stripped = line.strip()
        is_heading = False
        heading_title = ""

        # Check Markdown heading
        md_match = _HEADING_MD_REGEX.match(stripped)
        if md_match:
            is_heading = True
            heading_title = md_match.group(2).strip()
        else:
            # Check numbered heading: e.g. "3.2 Normalization Techniques"
            num_match = _HEADING_NUMERIC_REGEX.match(stripped)
            if num_match:
                is_heading = True
                heading_title = stripped
            elif stripped.isupper() and 3 < len(stripped) < 80 and len(stripped.split()) <= 8:
                is_heading = True
                heading_title = stripped.title()

        if is_heading:
            if current_lines:
                sec_text = "\n".join(current_lines).strip()
                if sec_text:
                    ctype = detect_content_type(sec_text)
                    sections.append(ParsedSection(
                        title=current_title,
                        page_number=page_number,
                        content=sec_text,
                        content_type=ctype
                    ))
                current_lines = []
            current_title = heading_title
            current_lines.append(stripped)
        else:
            current_lines.append(line)

    if current_lines:
        sec_text = "\n".join(current_lines).strip()
        if sec_text:
            ctype = detect_content_type(sec_text)
            sections.append(ParsedSection(
                title=current_title,
                page_number=page_number,
                content=sec_text,
                content_type=ctype
            ))

    return sections
