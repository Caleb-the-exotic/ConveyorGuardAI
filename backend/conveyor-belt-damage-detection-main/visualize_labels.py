#!/usr/bin/env python3

import os
import cv2
import glob

def visualize_custom_labels(data_dir="train/train/images", labels_dir="train/train/labels", output_dir="bbox_visualization", max_images=10):
    """
    Visualize bounding boxes with RED color to understand the custom label format
    """
    os.makedirs(output_dir, exist_ok=True)
    
    image_paths = sorted(glob.glob(os.path.join(data_dir, "*.jpg")))[:max_images]
    
    print(f"Processing {len(image_paths)} images...")
    
    for idx, img_path in enumerate(image_paths):
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
        print(f"\nImage {idx+1}: {filename}")
        print(f"Dimensions: {w}x{h}")
        
        with open(label_path, 'r') as f:
            content = f.read().strip()
            parts = content.split()
            
        print(f"Label values ({len(parts)}): {parts}")
        
        # Try different interpretations of the 11-value format
        if len(parts) == 11:
            try:
                class_id = int(float(parts[0]))
                
                # Hypothesis 1: Two bounding boxes (4 values each) + class + extra
                # First box: values 1-4
                x1_c, y1_c, w1, h1 = map(float, parts[1:5])
                
                # Convert first box to pixel coordinates
                x1_min = int((x1_c - w1/2) * w)
                y1_min = int((y1_c - h1/2) * h)
                x1_max = int((x1_c + w1/2) * w)
                y1_max = int((y1_c + h1/2) * h)
                
                # Ensure within bounds
                x1_min, y1_min = max(0, x1_min), max(0, y1_min)
                x1_max, y1_max = min(w, x1_max), min(h, y1_max)
                
                print(f"First box interpretation:")
                print(f"  Normalized: center=({x1_c:.3f}, {y1_c:.3f}), size=({w1:.3f}, {h1:.3f})")
                print(f"  Pixel coords: ({x1_min}, {y1_min}) to ({x1_max}, {y1_max})")
                
                # Draw first RED bounding box
                cv2.rectangle(img, (x1_min, y1_min), (x1_max, y1_max), (0, 0, 255), 3)  # RED
                cv2.putText(img, f"Box1 C:{class_id}", (x1_min, y1_min-10), 
                           cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 255), 2)
                
                # Try second box interpretation: values 5-8 or 6-9
                if len(parts) >= 9:
                    # Try values 6-9 as second box
                    x2_c, y2_c, w2, h2 = map(float, parts[6:10])
                    
                    x2_min = int((x2_c - w2/2) * w)
                    y2_min = int((y2_c - h2/2) * h)
                    x2_max = int((x2_c + w2/2) * w)
                    y2_max = int((y2_c + h2/2) * h)
                    
                    # Ensure within bounds
                    x2_min, y2_min = max(0, x2_min), max(0, y2_min)
                    x2_max, y2_max = min(w, x2_max), min(h, y2_max)
                    
                    print(f"Second box interpretation:")
                    print(f"  Normalized: center=({x2_c:.3f}, {y2_c:.3f}), size=({w2:.3f}, {h2:.3f})")
                    print(f"  Pixel coords: ({x2_min}, {y2_min}) to ({x2_max}, {y2_max})")
                    
                    # Draw second BLUE bounding box for comparison
                    cv2.rectangle(img, (x2_min, y2_min), (x2_max, y2_max), (255, 0, 0), 2)  # BLUE
                    cv2.putText(img, f"Box2", (x2_min, y2_min-10), 
                               cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 0, 0), 2)
                
            except Exception as e:
                print(f"Error processing labels: {e}")
        
        # Save the visualization
        out_path = os.path.join(output_dir, f"labeled_{filename}")
        success = cv2.imwrite(out_path, img)
        if success:
            print(f"Saved: {out_path}")
        else:
            print(f"Failed to save: {out_path}")
    
    print(f"\nVisualization complete! Check the '{output_dir}' folder.")
    print("RED boxes = first interpretation, BLUE boxes = second interpretation")

if __name__ == "__main__":
    visualize_custom_labels()