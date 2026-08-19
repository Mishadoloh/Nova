FROM alpine:3.22 AS build
RUN apk add --no-cache build-base cmake
WORKDIR /src
COPY . .
RUN cmake -S . -B build -DCMAKE_BUILD_TYPE=Release && \
    cmake --build build --parallel && \
    ctest --test-dir build --output-on-failure

FROM alpine:3.22
RUN apk add --no-cache libstdc++ libgcc && \
    addgroup -S nova && adduser -S -G nova nova
COPY --from=build /src/build/timer-engine /timer-engine
USER nova
EXPOSE 8070
ENTRYPOINT ["/timer-engine"]
