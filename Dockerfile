FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Create volume for logs and journal
VOLUME ["/app/data"]

CMD ["python", "run.py"]
