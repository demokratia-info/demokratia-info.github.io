#!/usr/bin/env python3
"""Tiny HTTPS CONNECT proxy with static GitHub host mappings.

This is for Codex automation environments where outbound TCP works but DNS is
unavailable. It does not inspect TLS traffic; it only maps known GitHub host
names to IP addresses and tunnels bytes.
"""

from __future__ import annotations

import argparse
import select
import socket
import socketserver
import sys
import threading
from typing import Dict, Tuple


HOSTS: Dict[str, Tuple[str, ...]] = {
    "github.com": ("20.217.135.5",),
    "api.github.com": ("20.217.135.0",),
    "codeload.github.com": ("20.217.135.8",),
    "uploads.github.com": ("20.217.135.1",),
    "objects.githubusercontent.com": (
        "185.199.108.133",
        "185.199.109.133",
        "185.199.110.133",
        "185.199.111.133",
    ),
    "raw.githubusercontent.com": (
        "185.199.108.133",
        "185.199.109.133",
        "185.199.110.133",
        "185.199.111.133",
    ),
    "demokratia-info.github.io": (
        "185.199.108.153",
        "185.199.109.153",
        "185.199.110.153",
        "185.199.111.153",
    ),
}


class ThreadingTCPServer(socketserver.ThreadingMixIn, socketserver.TCPServer):
    allow_reuse_address = True
    daemon_threads = True


class ConnectHandler(socketserver.BaseRequestHandler):
    timeout = 30

    def handle(self) -> None:
        self.request.settimeout(self.timeout)
        header = self._read_header()
        if not header:
            return

        first_line = header.split(b"\r\n", 1)[0].decode("ascii", "replace")
        parts = first_line.split()
        if len(parts) < 3 or parts[0].upper() != "CONNECT":
            self._reply(405, b"Only CONNECT is supported")
            return

        host, port = self._parse_target(parts[1])
        if port != 443 or host not in HOSTS:
            self._reply(403, b"Host is not in the static GitHub map")
            return

        upstream = self._connect_upstream(host, port)
        if upstream is None:
            self._reply(502, b"Could not connect to mapped upstream")
            return

        try:
            self.request.sendall(b"HTTP/1.1 200 Connection Established\r\n\r\n")
            self._tunnel(self.request, upstream)
        finally:
            upstream.close()

    def _read_header(self) -> bytes:
        data = bytearray()
        while b"\r\n\r\n" not in data and len(data) < 16384:
            chunk = self.request.recv(4096)
            if not chunk:
                break
            data.extend(chunk)
        return bytes(data)

    def _parse_target(self, target: str) -> Tuple[str, int]:
        if ":" not in target:
            return target.lower(), 443
        host, port_text = target.rsplit(":", 1)
        return host.lower(), int(port_text)

    def _connect_upstream(self, host: str, port: int) -> socket.socket | None:
        last_error = None
        for ip in HOSTS[host]:
            try:
                return socket.create_connection((ip, port), timeout=self.timeout)
            except OSError as exc:
                last_error = exc
        if last_error is not None:
            print(f"connect failed for {host}: {last_error}", file=sys.stderr)
        return None

    def _reply(self, code: int, body: bytes) -> None:
        reason = {
            403: b"Forbidden",
            405: b"Method Not Allowed",
            502: b"Bad Gateway",
        }.get(code, b"Error")
        self.request.sendall(
            b"HTTP/1.1 "
            + str(code).encode("ascii")
            + b" "
            + reason
            + b"\r\nContent-Length: "
            + str(len(body)).encode("ascii")
            + b"\r\nConnection: close\r\n\r\n"
            + body
        )

    def _tunnel(self, client: socket.socket, upstream: socket.socket) -> None:
        sockets = [client, upstream]
        while True:
            readable, _, _ = select.select(sockets, [], [], self.timeout)
            if not readable:
                return
            for sock in readable:
                other = upstream if sock is client else client
                data = sock.recv(65536)
                if not data:
                    return
                other.sendall(data)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument("--ready-file")
    args = parser.parse_args()

    with ThreadingTCPServer((args.host, args.port), ConnectHandler) as server:
        host, port = server.server_address
        if args.ready_file:
            with open(args.ready_file, "w", encoding="utf-8") as ready:
                ready.write(f"{host}:{port}\n")
        print(f"github_static_proxy listening on {host}:{port}", flush=True)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            return 0
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
