from core.performance_monitor import PerformanceMonitor
from core.performance_tracker import PerformanceTracker


def test_performance_monitor_report_collects_metrics_without_deadlock():
    monitor = PerformanceMonitor(
        max_api_calls=10,
        max_tool_executions=10,
        max_latency_metrics=10,
        max_resource_snapshots=10,
    )

    monitor.track_api_call("tool_spotify", 12.5, success=True)
    monitor.track_tool_execution(
        tool_name="spotify_controller",
        action="play",
        duration_ms=42.0,
        success=True,
        parameters={"query": "Aurora"},
        result_size=128,
    )
    monitor.track_latency(
        operation_type="tool_execution",
        total_duration_ms=42.0,
        processing_time_ms=42.0,
        success=True,
    )

    report = monitor.get_performance_report()

    assert report["api_calls"]["total_calls"] == 1
    assert "spotify_controller:play" in report["tool_executions"]
    assert report["tool_executions"]["spotify_controller:play"]["total_calls"] == 1
    assert report["latency"]["total_operations"] == 1


def test_performance_tracker_summary_returns_without_deadlock():
    tracker = PerformanceTracker()

    tracker.start_task("task-1", "spotify_lookup", total_steps=3)
    tracker.update_task_progress("task-1", progress_percent=50.0, current_step="searching")

    summary = tracker.get_performance_summary()

    assert summary["active_tasks"] == 1
    assert summary["waiting_for_input"] is False
    assert summary["current_activity"] in {"searching", "spotify_lookup"}
