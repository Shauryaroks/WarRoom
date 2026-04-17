import logging
import sys
import structlog


def setup_logging():
    # Disable uvicorn access logs completely
    logging.getLogger("uvicorn.access").disabled = True
    logging.getLogger("uvicorn.error").disabled = True

    # Configure structlog globally
    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.stdlib.add_logger_name,
            structlog.stdlib.add_log_level,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            structlog.processors.JSONRenderer(),
        ],
        wrapper_class=structlog.stdlib.BoundLogger,
        logger_factory=structlog.stdlib.LoggerFactory(),
        cache_logger_on_first_use=True,
    )

    # Configure standard logging to use structlog
    formatter = structlog.stdlib.ProcessorFormatter(
        foreign_pre_chain=[
            structlog.contextvars.merge_contextvars,
            structlog.stdlib.add_logger_name,
            structlog.stdlib.add_log_level,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.StackInfoRenderer(),
        ],
        processors=[
            structlog.stdlib.ProcessorFormatter.remove_processors_meta,
            structlog.processors.JSONRenderer(),
        ],
    )

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(formatter)

    root_logger = logging.getLogger()
    root_logger.addHandler(handler)
    root_logger.setLevel(logging.INFO)

    # Ensure our base keys are null if not provided
    # structlog doesn't natively default missing keys in JSONRenderer,
    # so we can use a custom processor for the constraints.

    def ensure_keys_processor(logger, log_method, event_dict):
        keys = [
            "timestamp",
            "level",
            "event",
            "logger",
            "request_id",
            "team_id",
            "user_id",
            "method",
            "path",
            "status_code",
            "duration_ms",
            "task_id",
            "round_number",
            "error",
            "error_detail",
        ]

        if "exception" in event_dict:
            exc_str = event_dict.pop("exception")
            if event_dict.get("level") == "error":
                event_dict["error_detail"] = exc_str
                if "error" not in event_dict:
                    event_dict["error"] = (
                        exc_str.split("\n")[-2] if "\n" in exc_str else exc_str
                    )
            else:
                if "error" not in event_dict:
                    event_dict["error"] = (
                        exc_str.split("\n")[-2] if "\n" in exc_str else exc_str
                    )

        if "exc_info" in event_dict:
            event_dict.pop("exc_info")

        new_dict = {}
        for key in keys:
            new_dict[key] = event_dict.get(key, None)

        return new_dict

    # Reconfigure structlog with the custom processor before JSONRenderer
    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.stdlib.add_logger_name,
            structlog.stdlib.add_log_level,
            structlog.processors.TimeStamper(fmt="iso", key="timestamp"),
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            ensure_keys_processor,
            structlog.processors.JSONRenderer(),
        ],
        wrapper_class=structlog.stdlib.BoundLogger,
        logger_factory=structlog.stdlib.LoggerFactory(),
        cache_logger_on_first_use=True,
    )

    # Update formatter
    formatter = structlog.stdlib.ProcessorFormatter(
        foreign_pre_chain=[
            structlog.contextvars.merge_contextvars,
            structlog.stdlib.add_logger_name,
            structlog.stdlib.add_log_level,
            structlog.processors.TimeStamper(fmt="iso", key="timestamp"),
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
        ],
        processors=[
            structlog.stdlib.ProcessorFormatter.remove_processors_meta,
            ensure_keys_processor,
            structlog.processors.JSONRenderer(),
        ],
    )

    # Remove existing handlers to avoid duplicates
    for h in list(root_logger.handlers):
        root_logger.removeHandler(h)

    handler.setFormatter(formatter)
    root_logger.addHandler(handler)
