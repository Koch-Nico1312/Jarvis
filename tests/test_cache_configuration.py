def test_runtime_cache_configuration_is_loaded(monkeypatch, tmp_path):
    import core.api_cache as api_cache_module
    import core.memory_manager as memory_manager_module
    import core.vector_cache as vector_cache_module
    from core.api_cache import get_api_cache
    from core.cache_manager import CacheManager
    from core.memory_manager import get_memory_manager
    from core.vector_cache import get_vector_cache

    monkeypatch.setattr(api_cache_module, "_api_cache", None)
    monkeypatch.setattr(memory_manager_module, "_memory_manager", None)
    monkeypatch.setattr(vector_cache_module, "_vector_cache", None)
    monkeypatch.setattr(vector_cache_module, "REDIS_AVAILABLE", False)

    api_cache = get_api_cache()
    memory_manager = get_memory_manager()
    vector_cache = get_vector_cache()

    assert api_cache.max_size >= 5000
    assert api_cache.ttl.total_seconds() >= 60 * 60
    assert api_cache.max_bytes >= 256 * 1024 * 1024
    assert memory_manager.max_memory_mb >= 2048
    assert memory_manager._max_cache_size >= 5000
    assert vector_cache.max_size >= 5000
    assert vector_cache.ttl.total_seconds() >= 6 * 60 * 60

    cache_manager = CacheManager(cache_dir=tmp_path / "cache")
    assert cache_manager.sqlite_cache_mb >= 256
    assert cache_manager.sqlite_mmap_mb >= 512
    assert cache_manager._max_pool_size >= 10
    assert cache_manager.max_entries >= 50000
    assert cache_manager.max_database_mb >= 512


class _EnabledFlags:
    def is_enabled(self, _flag):
        return True


def test_api_cache_keeps_recently_used_entries(monkeypatch):
    import core.api_cache as api_cache_module
    from core.api_cache import APICache

    monkeypatch.setattr(api_cache_module, "get_performance_flags", lambda: _EnabledFlags())

    cache = APICache(ttl_minutes=60, max_size=2, max_bytes=1024 * 1024)
    cache.set("alpha", {"value": 1})
    cache.set("beta", {"value": 2})

    assert cache.get("alpha") == {"value": 1}

    cache.set("gamma", {"value": 3})

    assert cache.get("alpha") == {"value": 1}
    assert cache.get("beta") is None
    assert cache.get("gamma") == {"value": 3}
    assert cache.get_stats()["size_bytes"] > 0


def test_api_cache_skips_oversized_entries(monkeypatch):
    import core.api_cache as api_cache_module
    from core.api_cache import APICache

    monkeypatch.setattr(api_cache_module, "get_performance_flags", lambda: _EnabledFlags())

    cache = APICache(ttl_minutes=60, max_size=10, max_bytes=8)
    cache.set("large", {"payload": "too-large"})

    assert cache.get("large") is None
    assert cache.get_stats()["size"] == 0


def test_vector_cache_keeps_recently_used_entries(monkeypatch):
    import core.vector_cache as vector_cache_module
    from core.vector_cache import VectorCache

    monkeypatch.setattr(vector_cache_module, "REDIS_AVAILABLE", False)
    monkeypatch.setattr(vector_cache_module, "get_performance_flags", lambda: _EnabledFlags())

    cache = VectorCache(ttl_hours=1, max_size=2)
    cache.set("alpha", [{"id": 1}])
    cache.set("beta", [{"id": 2}])

    assert cache.get("alpha") == [{"id": 1}]

    cache.set("gamma", [{"id": 3}])

    assert cache.get("alpha") == [{"id": 1}]
    assert cache.get("beta") is None
    assert cache.get("gamma") == [{"id": 3}]


def test_sqlite_cache_enforces_lru_entry_limit(tmp_path):
    from core.cache_manager import CacheManager

    cache = CacheManager(cache_dir=tmp_path / "cache")
    cache.max_entries = 2
    cache.set("alpha", {"value": 1})
    cache.set("beta", {"value": 2})

    assert cache.get("alpha") == {"value": 1}

    cache.set("gamma", {"value": 3})

    assert cache.get("alpha") == {"value": 1}
    assert cache.get("beta") is None
    assert cache.get("gamma") == {"value": 3}
