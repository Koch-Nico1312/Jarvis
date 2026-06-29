"""Simple test to verify API key functionality works."""
from pathlib import Path
import tempfile
from core.platform_hub import PlatformHub

def test_simple_api_key():
    """Test basic API key issuance."""
    tmp = Path(tempfile.mkdtemp())
    hub = PlatformHub(store_path=tmp / "test.json")
    
    # Use existing publication from defaults
    pubs = hub.data.get("publishing", [])
    assert len(pubs) > 0, "No publications found in default data"
    
    pub_id = pubs[0]["id"]
    
    # Issue API key
    response = hub.action("issue_publish_api_key", {"id": pub_id, "name": "Test Key"})
    
    # action() wraps result in {"status": "ok", "result": ..., "platform": ...}
    assert response.get("status") == "ok", f"Action failed: {response}"
    result = response.get("result", {})
    
    assert "api_key" in result, f"No api_key in result: {result.keys()}"
    assert result.get("status") == "issued", f"Status not 'issued': {result.get('status')}"
    assert "key_id" in result, f"No key_id in result: {result.keys()}"
