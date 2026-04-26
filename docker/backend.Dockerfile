FROM golang:1.26.1-alpine AS builder

WORKDIR /app

ARG TARGETOS=linux
ARG TARGETARCH=arm64

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=${TARGETOS} GOARCH=${TARGETARCH} go build -o /out/cenimatch ./cmd/cenimatch

FROM alpine:3.22

WORKDIR /app
RUN apk add --no-cache ca-certificates

COPY --from=builder /out/cenimatch /app/cenimatch

EXPOSE 8080
CMD ["/app/cenimatch"]
