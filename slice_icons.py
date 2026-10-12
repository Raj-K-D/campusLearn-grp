from PIL import Image
import os

# Load Image
img_path = r"E:\campuslearn\public\images\icons_sheet.jpg"
img = Image.open(img_path)
width, height = img.size

# Split into 3 parts
part_width = width // 3

# OS Icon (Left)
img.crop((0, 0, part_width, height)).save(r"E:\campuslearn\public\images\os.jpg")

# DSA Icon (Middle)
img.crop((part_width, 0, part_width*2, height)).save(r"E:\campuslearn\public\images\dsa.jpg")

# ML Icon (Right)
img.crop((part_width*2, 0, width, height)).save(r"E:\campuslearn\public\images\ml.jpg")

print("✅ Icons Sliced.")