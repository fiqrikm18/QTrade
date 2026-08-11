from fastapi import FastAPI


def create_app() -> FastAPI:
    return FastAPI(title="IHSG Quant API", version="0.1.0")


app = create_app()
