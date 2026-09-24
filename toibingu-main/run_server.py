import os
import uvicorn

if __name__ == "__main__":
    host = os.environ.get("HOST", "0.0.0.0")
    port = int(os.environ.get("PORT", 8000))
    print("=================================================================")
    print(" CYBERAUTH SECURITY - IDENTITY & LICENSE CONTROL SYSTEM v3.8")
    print(" Inspired by quocthaiAuth SECURITY Identity Architecture")
    print(f" Server starting on: http://{host}:{port}")
    print(f" Public Domain & Reverse Proxy Support: Active (0.0.0.0)")
    print("=================================================================")
    uvicorn.run(
        "app.main:app",
        host=host,
        port=port,
        reload=False,
        proxy_headers=True,
        forwarded_allow_ips="*"
    )

