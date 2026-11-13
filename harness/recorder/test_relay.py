"""Regression checks for complete and interrupted upstream streams."""
import http.client
import importlib.util
import json
import os
from pathlib import Path
import socket
import tempfile
import threading
import time
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from unittest.mock import patch


class Upstream(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def do_POST(self):
        self.rfile.read(int(self.headers.get('Content-Length', 0)))
        self.send_response(200)
        self.send_header('Transfer-Encoding', 'chunked')
        self.end_headers()
        self.wfile.write(b'5\r\nhello\r\n')
        self.wfile.flush()
        if self.path == '/bad':
            self.connection.shutdown(socket.SHUT_RDWR)
            self.close_connection = True
        else:
            self.wfile.write(b'0\r\n\r\n')
            self.wfile.flush()


class RelayStreamTest(unittest.TestCase):
    def test_complete_and_truncated_stream(self):
        with tempfile.TemporaryDirectory(dir='/tmp') as raw:
            upstream = ThreadingHTTPServer(('127.0.0.1', 0), Upstream)
            spec = importlib.util.spec_from_file_location('relay_under_test', Path(__file__).with_name('relay.py'))
            module = importlib.util.module_from_spec(spec)
            with patch.dict(os.environ, {'WC_UPSTREAM': f'http://127.0.0.1:{upstream.server_port}', 'WC_RAW': raw}):
                spec.loader.exec_module(module)
            relay = ThreadingHTTPServer(('127.0.0.1', 0), module.Relay)
            for server in (upstream, relay):
                threading.Thread(target=server.serve_forever, daemon=True).start()
            try:
                conn = http.client.HTTPConnection('127.0.0.1', relay.server_port, timeout=3)
                conn.request('POST', '/good', '{}')
                self.assertEqual(conn.getresponse().read(), b'hello')
                conn.close()
                conn = http.client.HTTPConnection('127.0.0.1', relay.server_port, timeout=3)
                conn.request('POST', '/bad', '{}')
                response = conn.getresponse()
                self.assertEqual(response.status, 200)
                with self.assertRaises(http.client.IncompleteRead):
                    response.read()
                conn.close()
                records = []
                for _ in range(100):
                    p = Path(raw, 'calls.jsonl')
                    records = [json.loads(line) for line in p.read_text().splitlines()] if p.exists() else []
                    if len(records) == 2:
                        break
                    time.sleep(0.01)
                self.assertEqual(len(records), 2)
                self.assertIsNone(records[0]['relay_error'])
                self.assertIsNotNone(records[1]['relay_error'])
            finally:
                for server in (relay, upstream):
                    server.shutdown()
                    server.server_close()


if __name__ == '__main__':
    unittest.main()
