#!/usr/bin/env python3
"""Check whether an OpenRouter model accepts one chat request."""

import argparse
import json
import os
import sys
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


ENDPOINT = "https://openrouter.ai/api/v1/chat/completions"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", default=os.getenv("OPENROUTER_MODEL", ""))
    parser.add_argument("--prompt", default="Reply with exactly: OPENROUTER_OK")
    args = parser.parse_args()

    api_key = os.getenv("OPENROUTER_API_KEY")
    if not api_key:
        print("Missing OPENROUTER_API_KEY", file=sys.stderr)
        return 2
    if not args.model:
        print("Missing --model or OPENROUTER_MODEL", file=sys.stderr)
        return 2

    body = json.dumps(
        {
            "model": args.model,
            "messages": [{"role": "user", "content": args.prompt}],
            "max_tokens": 32,
        }
    ).encode()
    request = Request(
        ENDPOINT,
        data=body,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )

    try:
        with urlopen(request, timeout=30) as response:
            result = json.load(response)
    except HTTPError as error:
        detail = error.read().decode(errors="replace")
        print(f"HTTP {error.code}: {detail}", file=sys.stderr)
        return 1
    except URLError as error:
        print(f"Network error: {error.reason}", file=sys.stderr)
        return 1

    choices = result.get("choices", [])
    if not choices:
        print(json.dumps(result, indent=2))
        return 1

    print(choices[0].get("message", {}).get("content", ""))
    print(f"OK: {args.model}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
