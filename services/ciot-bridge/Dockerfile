# CIOT Bridge — Windows Container (requerido para GeradorCIOT.exe)
# Build: docker build -t ciot-bridge .
# Run:  docker run -p 8080:8080 -e CIOT_EXE_PATH=C:\app\GeradorCIOT.exe ciot-bridge

FROM python:3.11-windowsservercore-ltsc2022

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY main.py .

# O GeradorCIOT.exe deve ser montado via volume ou copiado no build
# COPY GeradorCIOT.exe .
# COPY GeradorCIOTShared.dll .

ENV CIOT_EXE_PATH=C:\\app\\GeradorCIOT.exe
ENV PORT=8080

EXPOSE 8080

CMD ["python", "main.py"]
