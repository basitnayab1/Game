import subprocess
from pathlib import Path
from PIL import Image

def main():
    frames_dir = Path(r"c:\Users\Hp\Downloads\Personal\N5\qa2\src\build\video_frames")
    docs_dir = Path(r"c:\Users\Hp\Downloads\Personal\N5\qa2\docs")
    docs_dir.mkdir(parents=True, exist_ok=True)
    output_mp4 = docs_dir / "N5_Back_Navigation_Verification.mp4"
    ffmpeg_exe = r"C:\Program Files\BlueStacks_nxt\ffmpeg.exe"

    frame_files = sorted(frames_dir.glob("frame_*.png"))
    if not frame_files:
        print("No frames found!")
        return

    first_frame = Image.open(frame_files[0])
    width, height = first_frame.size
    print(f"Frame resolution: {width}x{height}, Total frames: {len(frame_files)}")

    # Ensure even dimensions for libopenh264 / yuv420p
    if width % 2 != 0:
        width -= 1
    if height % 2 != 0:
        height -= 1

    cmd = [
        ffmpeg_exe,
        "-y",
        "-f", "rawvideo",
        "-vcodec", "rawvideo",
        "-s", f"{width}x{height}",
        "-pix_fmt", "rgba",
        "-r", "20",
        "-i", "-",
        "-c:v", "libopenh264",
        "-pix_fmt", "yuv420p",
        "-b:v", "2M",
        str(output_mp4)
    ]

    print(f"Running ffmpeg to generate {output_mp4}...")
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE)

    for i, f in enumerate(frame_files):
        img = Image.open(f).convert("RGBA")
        if img.size != (width, height):
            img = img.resize((width, height))
        proc.stdin.write(img.tobytes())
        if (i + 1) % 50 == 0 or i == len(frame_files) - 1:
            print(f"Processed {i + 1}/{len(frame_files)} frames...")

    proc.stdin.close()
    stdout, stderr = proc.communicate()
    print("FFmpeg returncode:", proc.returncode)
    if proc.returncode != 0:
        print("FFmpeg stderr:", stderr.decode('utf-8', errors='ignore'))
    else:
        print(f"Successfully generated video: {output_mp4} ({output_mp4.stat().st_size} bytes)")

if __name__ == "__main__":
    main()

