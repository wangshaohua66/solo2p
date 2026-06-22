#!/usr/bin/env python3
"""Mock IPFS module for testing without real IPFS daemon."""
import hashlib
import json
import uuid


class MockIPFS:
    """Mock IPFS client that stores data in memory."""
    
    def __init__(self):
        self._storage = {}
    
    def add_bytes(self, data: bytes) -> str:
        """Store bytes and return CID."""
        cid = self._generate_cid(data)
        self._storage[cid] = data
        return cid
    
    def add_json(self, data: dict) -> str:
        """Store JSON and return CID."""
        json_bytes = json.dumps(data, sort_keys=True).encode('utf-8')
        return self.add_bytes(json_bytes)
    
    def cat(self, cid: str) -> bytes:
        """Retrieve data by CID."""
        return self._storage.get(cid, b'')
    
    def get_json(self, cid: str) -> dict:
        """Retrieve JSON by CID."""
        data = self.cat(cid)
        if data:
            return json.loads(data)
        return {}
    
    def _generate_cid(self, data: bytes) -> str:
        """Generate a CID-like hash."""
        sha256_hash = hashlib.sha256(data).hexdigest()
        return f'Qm{sha256_hash[:44]}'


# Global mock instance
_ipfs_mock = MockIPFS()


def get_ipfs():
    """Get mock IPFS client."""
    return _ipfs_mock
