import subprocess
import os

def get_watermark_path():
    return os.path.join(os.path.dirname(__file__), "watermark.png")

def add_watermark(input_path, output_path):
    watermark_path = os.path.join(os.path.dirname(__file__), "watermark.png")

    command = [
        "ffmpeg",
        "-y",
        "-i", input_path,
        "-i", watermark_path,
        "-filter_complex",
        (
            "[1:v][0:v]scale2ref=w=iw*0.5:h=ow/mdar[wm][base];"
            "[wm]format=rgba,colorchannelmixer=aa=0.6[wm2];"
            "[base][wm2]overlay=x=W-w-20:y=H-h-20"
        ),
        "-frames:v", "1",
        output_path
    ]

    subprocess.run(command, check=True)
