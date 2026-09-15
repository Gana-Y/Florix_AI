"""
prompts.py — Centralized Prompt Engineering for Florix AI
==========================================================
All AI prompts live here. This enables:
  - Easy A/B testing of different prompt strategies
  - Version control of prompt changes
  - Consistent persona and tone across all features
  - Clear separation between AI logic and endpoint logic
"""

# ── System Persona ─────────────────────────────────────────────────────────────
SYSTEM_PERSONA = (
    "You are Florix AI, a highly intelligent, premium, and friendly AI study assistant. "
    "You help students learn faster, understand complex topics deeply, and achieve their "
    "academic goals. Always be accurate, encouraging, and structure your responses clearly "
    "using Markdown formatting where appropriate."
)

RESPONSE_STYLE_NOTES = {
    "professional": "Use formal, well-structured language with clear headings and bullet points.",
    "simple":       "Explain everything in simple, plain language as if to a curious high school student. Avoid jargon.",
    "concise":      "Be extremely brief. Use short sentences and bullet points only. No fluff.",
    "detailed":     "Provide thorough, comprehensive explanations with examples, analogies, and deep coverage.",
}


# ── Text Chunking ──────────────────────────────────────────────────────────────
def chunk_text(text: str, max_chars: int = 14000) -> str:
    """
    Smart text chunking that respects sentence and paragraph boundaries.
    Much better than the previous hard 15000-char truncation.
    
    Strategy:
    1. If text fits, return as-is.
    2. Try to cut at a paragraph boundary.
    3. Fall back to sentence boundary.
    4. Fall back to word boundary.
    """
    if len(text) <= max_chars:
        return text

    chunk = text[:max_chars]

    # 1. Paragraph boundary
    last_para = chunk.rfind('\n\n')
    if last_para > max_chars * 0.75:
        return chunk[:last_para].strip() + "\n\n[Content truncated for processing...]"

    # 2. Sentence boundary
    for sep in ['. ', '.\n', '? ', '! ']:
        last_sent = chunk.rfind(sep)
        if last_sent > max_chars * 0.70:
            return chunk[:last_sent + 1].strip() + "\n\n[Content truncated for processing...]"

    # 3. Word boundary
    last_space = chunk.rfind(' ')
    if last_space > 0:
        return chunk[:last_space] + "\n\n[Content truncated for processing...]"

    return chunk + "\n\n[Content truncated for processing...]"


# ── Summary Prompts ────────────────────────────────────────────────────────────
def get_summary_prompt(content: str, style: str = "professional") -> str:
    style_note = RESPONSE_STYLE_NOTES.get(style, RESPONSE_STYLE_NOTES["professional"])
    safe_content = chunk_text(content)
    return (
        f"{SYSTEM_PERSONA} {style_note}\n\n"
        f"Create a comprehensive study summary of the following content in Markdown format.\n"
        f"Structure your summary with:\n"
        f"- ## Key Concepts (the most important ideas)\n"
        f"- ## Main Points (bullet-point breakdown)\n"
        f"- ## Important Definitions (any key terms)\n"
        f"- ## Key Takeaways (3-5 actionable insights)\n\n"
        f"CONTENT TO SUMMARIZE:\n{safe_content}"
    )


# ── Quiz Prompts ───────────────────────────────────────────────────────────────
def get_quiz_prompt(content: str, num_questions: int) -> str:
    safe_content = chunk_text(content)
    return (
        f"{SYSTEM_PERSONA}\n\n"
        f"Create exactly {num_questions} multiple-choice quiz questions from the content below.\n"
        f"Rules:\n"
        f"- Questions must test genuine understanding, not just memorization.\n"
        f"- Each question must have exactly 4 options (A, B, C, D).\n"
        f"- Include a brief explanation for the correct answer.\n"
        f"- Return ONLY a valid JSON array. No markdown, no explanation outside the JSON.\n\n"
        f"JSON format:\n"
        f'[{{"question": "...", "options": ["A) ...", "B) ...", "C) ...", "D) ..."], '
        f'"correct": "A) ...", "explanation": "Why this is correct..."}}]\n\n'
        f"CONTENT:\n{safe_content}"
    )


# ── Flashcard Prompts ──────────────────────────────────────────────────────────
def get_flashcard_prompt(content: str, num_cards: int) -> str:
    safe_content = chunk_text(content)
    return (
        f"{SYSTEM_PERSONA}\n\n"
        f"Create exactly {num_cards} study flashcards from the content below.\n"
        f"Rules:\n"
        f"- Front: A clear question, term, or concept.\n"
        f"- Back: A concise, complete answer or definition.\n"
        f"- Cover a variety of topics from the content.\n"
        f"- Return ONLY a valid JSON array. No markdown outside the JSON.\n\n"
        f"JSON format:\n"
        f'[{{"front": "Question or term", "back": "Answer or definition"}}]\n\n'
        f"CONTENT:\n{safe_content}"
    )


# ── Document Chat Prompts ──────────────────────────────────────────────────────
def get_document_chat_prompt(
    message: str,
    document_context: str,
    history: str = "",
    response_style: str = "professional"
) -> str:
    style_note = RESPONSE_STYLE_NOTES.get(response_style, RESPONSE_STYLE_NOTES["professional"])
    safe_context = chunk_text(document_context, max_chars=10000)
    history_section = f"\nCONVERSATION HISTORY:\n{history}\n" if history else ""
    return (
        f"{SYSTEM_PERSONA} {style_note}\n\n"
        f"DOCUMENT CONTEXT (use this as your primary knowledge source):\n{safe_context}\n"
        f"{history_section}\n"
        f"User's question: {message}\n\n"
        f"Answer based on the document context. If the answer isn't in the document, "
        f"say so clearly and offer general knowledge if relevant."
    )


# ── Global AI Chat Prompts ─────────────────────────────────────────────────────
def get_global_chat_prompt(
    message: str,
    history: str = "",
    response_style: str = "professional"
) -> str:
    style_note = RESPONSE_STYLE_NOTES.get(response_style, RESPONSE_STYLE_NOTES["professional"])
    history_section = f"\nCONVERSATION HISTORY:\n{history}\n" if history else ""
    return (
        f"{SYSTEM_PERSONA} {style_note}\n"
        f"{history_section}\n"
        f"User: {message}\n\n"
        f"Provide a helpful, accurate response."
    )


# ── Audio / Transcription Prompts ──────────────────────────────────────────────
def get_audio_summary_prompt() -> str:
    return (
        f"{SYSTEM_PERSONA}\n\n"
        f"The following is a transcription of an audio recording. "
        f"Create a structured study summary in Markdown format with key points, "
        f"main topics discussed, and important takeaways."
    )


# ── Web / YouTube Content Prompts ──────────────────────────────────────────────
def get_web_summary_prompt(source_type: str = "web") -> str:
    source_label = "YouTube video transcript" if source_type == "youtube" else "web article"
    return (
        f"{SYSTEM_PERSONA}\n\n"
        f"Summarize the following {source_label} as study notes in Markdown format. "
        f"Include: Key ideas, important facts, and any actionable insights."
    )
