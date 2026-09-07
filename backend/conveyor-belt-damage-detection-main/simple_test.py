#!/usr/bin/env python3

import os
import cv2

# Test loading just one image and one label
img_path = "train/train/images/20260131_220303_792369_jpg.rf.639015ea4d2cdfaad4d9abd005e6069b.jpg"
label_path = "train/train/labels/20260131_220303_792369_jpg.rf.639015ea4d2cdfaad4d9abd005e6069b.txt"

print("Testing image loading...")
print(f"Image path exists: {os.path.exists(img_path)}")
print(f"Label path exists: {os.path.exists(label_path)}")

if os.path.exists(img_path):
    img = cv2.imread(img_path)
    if img is not None:
        h, w, _ = img.shape
        print(f"Image loaded successfully: {w}x{h}")
    else:
        print("Failed to load image")

if os.path.exists(label_path):
    with open(label_path, 'r') as f:
        content = f.read().strip()
        print(f"Label content: {content}")
        parts = content.split()
        print(f"Number of values in label: {len(parts)}")

print("Simple test complete!")