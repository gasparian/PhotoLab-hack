#!/bin/bash
gunicorn --bind=0.0.0.0:8003 --workers=2 -k gthread --thread=2  --timeout 90 --chdir /root/photolab_hack app:app --reload
