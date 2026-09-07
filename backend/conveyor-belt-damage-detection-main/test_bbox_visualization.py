#!/usr/bin/env python3

import os
import cv2
import glob

def visualize_bboxes(data_dir="train/train/images", labels_dir="train/train/labels", output_dir="test_bbox_output", max_images=3):
    """
    Create test visualization of bounding boxes with red color to verify what they represent
    """
    os.makedirs(output_dir, exist_ok=True)
    
    image_paths = sorted(glob.glob(os.path.join(data_dir, "*.jpg")))[:max_images]
    
    print(f"Processing {len(image_paths)} images...")
    
    for img_path in image_paths:
        filename = os.path.basename(img_path)
        label_path = os.path.join(labels_dir, filename.replace(".jpg", ".txt"))
        
        if not os.path.exists(label_path):
            print(f"No label file for {filename}")
            continue
            
        img = cv2.imread(img_path)
        if img is None:
            print(f"Could not load image: {filename}")
            continue
            
        h, w, _ = img.shape
        print(f"\nProcessing: {filename}")
        print(f"Image dimensions: {w}x{h}")
        
        with open(label_path, 'r') as f:
            lines = f.readlines()
            
        for i, line in enumerate(lines):
            parts = line.strip().split()
            print(f"Label line {i}: {len(parts)} values: {parts}")
            
            if len(parts) >= 5:
                # Try interpreting as YOLO format first (standard assumption)
                try:
                    class_id = int(parts[0])
                    x_c, y_c, bw, bh = map(float, parts[1:5])
                    
                    # Convert to pixel coordinates
                    x_min = int((x_c - bw/2) * w)
                    y_min = int((y_c - bh/2) * h)
                    x_max = int((x_c + bw/2) * w)
                    y_max = int((y_c + bh/2) * h)
                    
                    # Ensure within bounds
                    x_min, y_min = max(0, x_min), max(0, y_min)
                    x_max, y_max = min(w, x_max), min(h, y_max)
                    
                    print(f"  YOLO format interpretation - Class: {class_id}")
                    print(f"  Normalized: center=({x_c:.3f}, {y_c:.3f}), size=({bw:.3f}, {bh:.3f})")
                    print(f"  Pixel coordinates: ({x_min}, {y_min}) to ({x_max}, {y_max})")
                    
                    # Draw RED bounding box
                    cv2.rectangle(img, (x_min, y_min), (x_max, y_max), (0, 0, 255), 2)  # Red color (BGR format)
                    
                    # Add label text
                    label_text = f"Class:{class_id} Box:{i}"
                    cv2.putText(img, label_text, (x_min, y_min-10), 
                               cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 255), 1)
                    
                except Exception as e:
                    print(f"  Error processing as YOLO format: {e}")
        
        # Save the visualization
        out_path = os.path.join(output_dir, f"bbox_viz_{filename}")
        cv2.imwrite(out_path, img)
        print(f"Saved visualization: {out_path}")
        
        # Also try to crop and save what the current crop_script.py would extract
        crop_img = img.copy()
        for i, line in enumerate(lines):
            parts = line.strip().split()
            if len(parts) >= 5:
                try:
                    x_c, y_c, bw, bh = map(float, parts[1:5])
                    
                    # Convert to pixel coordinates (same as crop_script.py)
                    x_min = int((x_c - bw/2) * w)
                    y_min = int((y_c - bh/2) * h)
                    x_max = int((x_c + bw/2) * w)
                    y_max = int((y_c + bh/2) * h)
                    
                    # Ensure within bounds
                    x_min, y_min = max(0, x_min), max(0, y_min)
                    x_max, y_max = min(w, x_max), min(h, y_max)
                    
                    # Crop
                    crop = crop_img[y_min:y_max, x_min:x_max]
                    
                    if crop.size > 0:
                        crop_name = f"crop_{filename.replace('.jpg', '')}_box_{i}.jpg"
                        crop_path = os.path.join(output_dir, crop_name)
                        cv2.imwrite(crop_path, crop)
                        print(f"Saved crop: {crop_path}")
                        
                except Exception as e:
                    print(f"Error cropping box {i}: {e}")

if __name__ == "__main__":
    visualize_bboxes()