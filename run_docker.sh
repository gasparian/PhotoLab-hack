#!/bin/bash
docker run --rm -it -v /tmp:/tmp -v /root/.aws:/root/.aws -p 8080:8000 --ipc=host gasparjan/photolab_hack:latest
