import uvicorn

if __name__ == "__main__":
    print("=================================================================")
    print(" CYBERAUTH SECURITY - IDENTITY & LICENSE CONTROL SYSTEM v3.8")
    print(" Inspired by quocthaiAuth SECURITY Identity Architecture")
    print(" Server starting on: http://127.0.0.1:8000")
    print("=================================================================")
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=False)
