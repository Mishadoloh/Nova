import os

import uvicorn


def main() -> None:
    uvicorn.run(
        "nova_analytics.app:app",
        host="0.0.0.0",
        port=int(os.environ.get("NOVA_ANALYTICS_PORT", "8090")),
        access_log=False,
        proxy_headers=False,
        server_header=False,
    )


if __name__ == "__main__":
    main()

