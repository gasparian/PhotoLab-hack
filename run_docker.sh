#!/bin/bash
docker run --rm -it -v /tmp:/tmp -p 8080:8000 --ipc=host gasparjan/photolab_hack:latest
