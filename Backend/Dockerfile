FROM python:3.10-slim

WORKDIR /app

# Install system dependencies required for pdf processing, database drivers, and healthcheck
RUN apt-get update && apt-get install -y gcc libpq-dev curl && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Create persistent directories for data, uploads, and ChromaDB
RUN mkdir -p /app/data /app/uploads /app/chroma_db

# Create non-root user
RUN useradd -m -u 10001 appuser && \
    chown -R appuser:appuser /app

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 8000

# Command to run the application
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
