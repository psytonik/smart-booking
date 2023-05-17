FROM ubuntu:latest
LABEL authors="anthonyfink"

ENTRYPOINT ["top", "-b"]
