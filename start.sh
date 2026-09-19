#!/bin/bash
set -e
cd backend/ml
echo "Starting backend server with gunicorn on port ${PORT:-8080}..."
exec gunicorn -w 1 -k gthread --threads 4 -b 0.0.0.0:${PORT:-8080} --timeout 120 server:app
