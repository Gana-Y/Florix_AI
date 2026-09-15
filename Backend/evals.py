"""
Florix AI — Automated LLM Evaluation Suite (LLM-as-a-Judge)

This script implements offline evaluation for the RAG (Retrieval-Augmented Generation) pipeline.
It assesses quality across three core dimensions of modern LLM Evaluation:
1. Faithfulness (Hallucination Detection): Is the answer fully grounded in the retrieved context?
2. Answer Relevance: Does the generated answer directly address the query?
3. Context Recall: Does the retrieved context contain the required gold-standard information?
"""

import os
import sys
import json
import logging
from google import genai
from dotenv import load_dotenv

# Reconfigure stdout to support UTF-8 print (specifically for Windows terminals and emojis)
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

# Setup Logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("evals")

load_dotenv()

# Initialize Gemini Client
api_key = os.getenv("GEMINI_API_KEY")
if not api_key:
    raise ValueError("GEMINI_API_KEY environment variable is not set")
client = genai.Client(api_key=api_key)

# The Model being evaluated & the Judge Model
EVAL_MODEL = "gemini-2.5-flash"
JUDGE_MODEL = "gemini-2.5-flash"

# Mock Evaluation Dataset (Golden Q&A + Context)
EVAL_DATASET = [
    {
        "query": "What is the primary power source of the Florix AI core system?",
        "gold_context": "The Florix AI core system is powered by a high-efficiency thermonuclear fusion reactor that delivers 2.5 Gigawatts of continuous clean energy.",
        "retrieved_context": "The Florix AI core system is powered by a high-efficiency thermonuclear fusion reactor that delivers 2.5 Gigawatts of continuous clean energy. Auxiliary power is supplied by lithium-ion battery banks.",
        "generated_answer": "According to the system specifications, the primary power source for the Florix AI core is a high-efficiency thermonuclear fusion reactor providing 2.5 Gigawatts of continuous clean energy."
    },
    {
        "query": "How does the system handle high-concurrency rate limit spikes?",
        "gold_context": "Concurrency spikes are mediated by a distributed Redis rate-limiting queue that temporarily buffers requests and returns HTTP 429 when capacity exceeds 10,000 requests per minute.",
        "retrieved_context": "Auxiliary power is supplied by lithium-ion battery banks. The system dashboard provides real-time CPU analytics.",
        "generated_answer": "The system monitors concurrency spikes and shows CPU analytics on the real-time system dashboard. It handles auxiliary load using battery banks."
    },
    {
        "query": "What security standard does the user login authentication follow?",
        "gold_context": "User authentication follows the industry-standard OAuth2 protocol utilizing secure JSON Web Tokens (JWT) signed with HS256 and bcrypt password hashing.",
        "retrieved_context": "User authentication follows the industry-standard OAuth2 protocol utilizing secure JSON Web Tokens (JWT) signed with HS256 and bcrypt password hashing. Local storage caches user login sessions.",
        "generated_answer": "Our auth system is highly secure. It uses passwords that are securely encrypted, and lets users log in using their credentials which are stored in the local SQLite database."
    }
]


def judge_faithfulness(context: str, answer: str) -> dict:
    """Evaluates if the answer has hallucinations or is 100% grounded in the context."""
    prompt = f"""
    You are an expert AI Auditor. Your task is to evaluate the FAITHFULNESS of a generated answer compared to the provided context.
    An answer is faithful if it contains ONLY statements that can be directly inferred from the provided context. 
    If the answer contains assumptions, external facts, or hallucinations not mentioned in the context, it is NOT faithful.

    [Context]
    {context}

    [Generated Answer]
    {answer}

    Assess the faithfulness on a scale of 0.0 to 1.0 (where 1.0 means perfectly grounded, 0.0 means complete hallucination or ungrounded statements).
    Return ONLY a valid JSON object matching this structure. Do not wrap in markdown tags or output any other text:
    {{"score": 0.85, "reason": "Explain your score briefly in one sentence."}}
    """
    try:
        response = client.models.generate_content(
            model=JUDGE_MODEL,
            contents=prompt,
        )
        return parse_judge_response(response.text)
    except Exception as e:
        logger.error(f"Faithfulness grading failed: {e}")
        return {"score": 0.0, "reason": f"Grading error: {str(e)}"}


def judge_answer_relevance(query: str, answer: str) -> dict:
    """Evaluates if the generated answer directly and completely addresses the user's query."""
    prompt = f"""
    You are an expert AI Auditor. Your task is to evaluate the RELEVANCE of a generated answer compared to the user's query.
    An answer is highly relevant if it directly, accurately, and completely answers the question without rambling or going off-topic.

    [User Query]
    {query}

    [Generated Answer]
    {answer}

    Assess the relevance on a scale of 0.0 to 1.0 (where 1.0 means perfectly relevant and complete, 0.0 means completely off-topic or empty).
    Return ONLY a valid JSON object matching this structure. Do not wrap in markdown tags or output any other text:
    {{"score": 0.90, "reason": "Explain your score briefly in one sentence."}}
    """
    try:
        response = client.models.generate_content(
            model=JUDGE_MODEL,
            contents=prompt,
        )
        return parse_judge_response(response.text)
    except Exception as e:
        logger.error(f"Relevance grading failed: {e}")
        return {"score": 0.0, "reason": f"Grading error: {str(e)}"}


def judge_context_recall(gold_context: str, retrieved_context: str) -> dict:
    """Evaluates if the retrieved chunks contain the required key facts from the gold-standard context."""
    prompt = f"""
    You are an expert AI Auditor. Your task is to evaluate the CONTEXT RECALL of a RAG retrieval system.
    You must determine if the retrieved context successfully contains all the critical facts present in the gold-standard context.

    [Gold-Standard Context]
    {gold_context}

    [Retrieved Context]
    {retrieved_context}

    Assess the context recall on a scale of 0.0 to 1.0 (where 1.0 means all gold-standard facts were successfully retrieved, 0.0 means no relevant facts were retrieved).
    Return ONLY a valid JSON object matching this structure. Do not wrap in markdown tags or output any other text:
    {{"score": 0.75, "reason": "Explain your score briefly in one sentence."}}
    """
    try:
        response = client.models.generate_content(
            model=JUDGE_MODEL,
            contents=prompt,
        )
        return parse_judge_response(response.text)
    except Exception as e:
        logger.error(f"Recall grading failed: {e}")
        return {"score": 0.0, "reason": f"Grading error: {str(e)}"}


def parse_judge_response(raw_text: str) -> dict:
    """Safely extracts JSON from LLM outputs."""
    try:
        # Strip markdown wrappers
        clean = raw_text.replace("```json", "").replace("```", "").strip()
        start = clean.find("{")
        end = clean.rfind("}") + 1
        if start == -1 or end == 0:
            return {"score": 0.0, "reason": f"Malformed LLM output: {raw_text}"}
        return json.loads(clean[start:end])
    except Exception as e:
        logger.error(f"JSON Parse Error of Judge response: {e}. Raw: {raw_text}")
        return {"score": 0.0, "reason": f"JSON Parsing failed: {str(e)}"}


def run_evaluation_suite():
    """Runs the full evaluation dataset and prints a beautiful metrics dashboard."""
    print("\n" + "="*80)
    print("🚀  FLORIX AI — RAG PIPELINE LLM-AS-A-JUDGE EVALUATION SUITE  🚀")
    print("="*80)
    
    total_faithfulness = 0.0
    total_relevance = 0.0
    total_recall = 0.0
    count = len(EVAL_DATASET)

    for i, data in enumerate(EVAL_DATASET):
        print(f"\n📝 Test Case #{i+1}: Query: '{data['query'][:60]}...'")
        print("-"*80)
        
        # 1. Grade Faithfulness
        faith = judge_faithfulness(data["retrieved_context"], data["generated_answer"])
        print(f"🔹 Faithfulness (Hallucination check): {faith['score']:.2f} | Reason: {faith['reason']}")
        total_faithfulness += faith["score"]
        
        # 2. Grade Relevance
        relevance = judge_answer_relevance(data["query"], data["generated_answer"])
        print(f"🔹 Answer Relevance                 : {relevance['score']:.2f} | Reason: {relevance['reason']}")
        total_relevance += relevance["score"]
        
        # 3. Grade Context Recall
        recall = judge_context_recall(data["gold_context"], data["retrieved_context"])
        print(f"🔹 Context Recall (Retrieval power) : {recall['score']:.2f} | Reason: {recall['reason']}")
        total_recall += recall["score"]
        
    print("\n" + "="*80)
    print("📊  FINAL RAG PIPELINE PERFORMANCE DASHBOARD  📊")
    print("="*80)
    print(f"⭐ Average Faithfulness (Groundedness) : {total_faithfulness / count * 100:.1f}%")
    print(f"⭐ Average Answer Relevance            : {total_relevance / count * 100:.1f}%")
    print(f"⭐ Average Context Recall (Retrieval)  : {total_recall / count * 100:.1f}%")
    print("="*80 + "\n")


if __name__ == "__main__":
    run_evaluation_suite()
