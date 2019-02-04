#!/bin/bash
gunicorn --bind=0.0.0.0:8000 --workers=2 -k gthread --thread=1  --timeout 90 --chdir /root/photolab_hack app:app --reload --max-requests 10
